import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { fetchMenuCatalog } from "../../menu/api/menuApi";
import {
  createPosOrder,
  lookupPendingCounterOrders,
  payPendingCounterOrder,
} from "../api/ordersApi";
import { downloadReceipt, printReceipt, printThermalReceipt } from "../utils/receiptUtils";
import { getImageUrl } from "../../menu/utils/image";
import { useAuth } from "../../auth/context/useAuth";
import ThermalReceipt from "../components/ThermalReceipt";

// Specialized SVG illustration for drinks that don't have an uploaded photo
function DrinkIllustration({ className = "w-16 h-24" }) {
  return (
    <svg viewBox="0 0 80 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="coffeeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c89666" />
          <stop offset="30%" stopColor="#92400e" />
          <stop offset="70%" stopColor="#451a03" />
          <stop offset="100%" stopColor="#1e1008" />
        </linearGradient>
        <linearGradient id="foamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      {/* Cup glass body */}
      <path
        d="M17 18 L23 106 C23 112 28 116 34 116 L46 116 C52 116 57 112 57 106 L63 18 Z"
        fill="url(#coffeeGradient)"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />
      {/* Milk swirl layer */}
      <path
        d="M19 42 Q 40 56, 61 42 L62 30 Q 40 38, 18 30 Z"
        fill="#fdfbf7"
        opacity="0.88"
      />
      {/* Top cream / foam */}
      <ellipse cx="40" cy="18" rx="23" ry="7" fill="url(#foamGradient)" />
      {/* Cocoa sprinkles */}
      <circle cx="34" cy="17" r="1.5" fill="#78350f" opacity="0.6" />
      <circle cx="44" cy="19" r="1.3" fill="#78350f" opacity="0.6" />
      <circle cx="40" cy="15" r="1" fill="#78350f" opacity="0.5" />
      {/* Glass reflection */}
      <path
        d="M21 26 L25 100"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

// Product Card Component matching the reference layout
function ProductCard({
  item,
  onAddToCart,
  onOpenCustomizer,
  isInCart,
}) {
  const [selectedSize, setSelectedSize] = useState(() => {
    return item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null;
  });
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const sizeAdjustment = selectedSize ? Number(selectedSize.price_adjustment || 0) : 0;
  const currentUnitPrice = Number(item.base_price) + sizeAdjustment;

  function handleAdd() {
    onAddToCart({
      item,
      size: selectedSize,
      quantity,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  }

  const isButtonActive = justAdded || isInCart;

  return (
    <div className="group flex flex-col justify-between rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-amber-700/30 hover:shadow-md">
      {/* Upper content row */}
      <div className="flex gap-4">
        {/* Drink Image / Illustration */}
        <div className="relative flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-100 bg-[#faf7f3] sm:h-36 sm:w-28">
          {item.image_url ? (
            <img
              src={getImageUrl(item.image_url)}
              alt={item.item_name}
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <DrinkIllustration className="h-28 w-20 transition-transform duration-300 group-hover:scale-105" />
          )}
          {!item.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-2xs">
              <span className="rounded-md bg-rose-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {/* Title & Price Header */}
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-bold text-stone-900 text-sm sm:text-base truncate group-hover:text-amber-950">
                {item.item_name}
              </h3>
              <span className="shrink-0 font-bold text-amber-800 text-sm sm:text-base">
                ₱{currentUnitPrice.toFixed(2)}
              </span>
            </div>

            {/* Description */}
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-400">
              {item.description || "The combination of coffee, milk, and specialty roast creates a velvety taste."}
            </p>
          </div>

          {/* Size Selector Row */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {item.sizes && item.sizes.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-stone-400 mr-0.5">Size</span>
                {item.sizes.map((s) => {
                  const isSelected = selectedSize?.menu_item_size_id === s.menu_item_size_id;
                  return (
                    <button
                      key={s.menu_item_size_id}
                      type="button"
                      disabled={!item.is_available}
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition shadow-2xs ${
                        isSelected
                          ? "bg-stone-900 text-white shadow-xs"
                          : "border border-stone-200 bg-stone-50/80 text-stone-600 hover:border-stone-400 hover:bg-stone-100"
                      }`}
                    >
                      {s.size_name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-stone-400">Standard Size</span>
            )}

            {/* Customizer / Options link */}
            {item.addons && item.addons.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenCustomizer(item)}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline ml-auto"
              >
                + Addons
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls row */}
      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
        {/* Stepper pill */}
        <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50/90 px-2 py-1 gap-2.5">
          <button
            type="button"
            disabled={quantity <= 1 || !item.is_available}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-5 w-5 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900 font-bold transition disabled:opacity-30"
          >
            -
          </button>
          <span className="w-4 text-center text-xs font-black text-stone-900">
            {quantity}
          </span>
          <button
            type="button"
            disabled={!item.is_available}
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900 font-bold transition disabled:opacity-30"
          >
            +
          </button>
        </div>

        {/* Add to Cart button */}
        <button
          type="button"
          disabled={!item.is_available}
          onClick={handleAdd}
          className={`rounded-full px-5 py-2 text-xs font-bold transition-all duration-200 shadow-xs ${
            isButtonActive
              ? "bg-amber-800 text-white hover:bg-amber-900"
              : "border border-amber-800/40 text-amber-800 hover:bg-amber-800 hover:text-white"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isButtonActive ? "Added to cart" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

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
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState("all"); // "all" | "in_stock"
  const [sortBy, setSortBy] = useState("default"); // "default" | "price_asc" | "price_desc" | "name"

  // Register Ticket & POS Cart
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderType, setOrderType] = useState("dine_in"); // "dine_in" | "takeout" | "delivery"
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [editingPendingOrder, setEditingPendingOrder] = useState(null);

  // Live order sequence reference number for UI display (matching Order #3243 in image)
  const [orderReferenceNumber] = useState(() => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  });

  // Customization drawer/modal for selected item
  const [customizingItem, setCustomizingItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Staff user context & Receipt preview
  const { user } = useAuth();
  const staffName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username
    : "Counter Cashier";
  const staffEmail = user?.email || "cashier@ldrncoffee.com";

  // Checkout submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posError, setPosError] = useState("");
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);

  // --- LOOK UP PENDING ORDER STATE ---
  const [lookupQuery, setLookupQuery] = useState("");
  const [isSearchingLookup, setIsSearchingLookup] = useState(false);
  const [lookupResults, setLookupResults] = useState([]);
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
    let items = allItems.filter((item) => {
      const matchesCat =
        selectedCategory === "all" ||
        item.category_name.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query));
      const matchesAvail =
        availabilityFilter === "all" || (availabilityFilter === "in_stock" && item.is_available);
      return matchesCat && matchesSearch && matchesAvail;
    });

    if (sortBy === "price_asc") {
      items = [...items].sort((a, b) => Number(a.base_price) - Number(b.base_price));
    } else if (sortBy === "price_desc") {
      items = [...items].sort((a, b) => Number(b.base_price) - Number(a.base_price));
    } else if (sortBy === "name") {
      items = [...items].sort((a, b) => a.item_name.localeCompare(b.item_name));
    }

    return items;
  }, [allItems, selectedCategory, searchQuery, availabilityFilter, sortBy]);

  // Direct add from card
  function handleDirectAddToCart({ item, size, quantity }) {
    const sizeAdjustment = size ? Number(size.price_adjustment || 0) : 0;
    const unitPrice = Number(item.base_price) + sizeAdjustment;

    const cartEntry = {
      cart_id: `pos-${Date.now()}-${Math.random()}`,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      image_url: item.image_url,
      menu_item_size_id: size ? size.menu_item_size_id : null,
      size_name: size ? size.size_name : null,
      addon_ids: [],
      addons: [],
      special_instructions: null,
      unit_price: unitPrice,
      quantity: quantity || 1,
    };

    if (activeMode === "lookup" && selectedPendingOrder) {
      setPendingItems((prev) => [...prev, cartEntry]);
    } else {
      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (c) =>
            c.menu_item_id === cartEntry.menu_item_id &&
            c.menu_item_size_id === cartEntry.menu_item_size_id &&
            (!c.addons || c.addons.length === 0) &&
            !c.special_instructions
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + cartEntry.quantity,
          };
          return updated;
        }
        return [...prev, cartEntry];
      });
    }
  }

  // Open item customization modal
  function handleOpenCustomizer(item) {
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
      image_url: customizingItem.image_url,
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

  function removeCartItem(cartId) {
    setCart((prev) => prev.filter((item) => item.cart_id !== cartId));
  }

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  }, [cart]);

  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  // Change Calculation for Register Cart
  const numericTendered = parseFloat(amountTendered) || 0;
  const registerChangeDue = numericTendered >= total ? numericTendered - total : 0;

  // Submit POS Order
  async function handleCheckout(e) {
    if (e) e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === "cash" && amountTendered !== "" && numericTendered < total) {
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
          amount_tendered: paymentMethod === "cash" ? (numericTendered || total) : null,
          items: itemsPayload,
        };
        result = await payPendingCounterOrder(editingPendingOrder.order_id, payload);
      } else {
        const payload = {
          customer_name: customerName.trim() || "Walk-in Guest",
          customer_email: customerEmail.trim() || null,
          order_type: orderType === "delivery" ? "takeout" : orderType,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? (numericTendered || total) : null,
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
        setPosError("Insufficient inventory: One of the selected items cannot be prepared due to low stock.");
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
        image_url: it.image_url,
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
        loadPendingOrders("", qRef);
      } else {
        loadPendingOrders("");
      }
    }
  }, [location.key, location.state, searchParams]);

  async function handleConfirmCounterPayment(e) {
    if (e) e.preventDefault();
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
      {/* ========================================================================= */}
      {/* TOP BAR: SEARCH WITH FILTER PILL & USER PROFILE (REFERENCE LAYOUT)        */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Bar & Filter Container */}
        <div className="relative flex-1 max-w-2xl">
          <div className="flex items-center rounded-full border border-stone-200/90 bg-white px-4 py-1.5 shadow-2xs transition-all focus-within:border-amber-700 focus-within:ring-2 focus-within:ring-amber-200/50">
            <span className="text-stone-400 pl-1 pr-2 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-stone-400 hover:text-stone-600 px-1 text-xs"
              >
                ✕
              </button>
            )}
            {/* Orange / Amber Filter Button */}
            <button
              type="button"
              onClick={() => setShowFilterDropdown((v) => !v)}
              className="ml-2 flex items-center gap-1.5 rounded-full bg-amber-800 hover:bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition shrink-0"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Filter</span>
            </button>
          </div>

          {/* Filter Popover Dropdown */}
          {showFilterDropdown && (
            <div className="absolute left-0 mt-2 z-30 w-72 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-black uppercase text-stone-800">Filter Menu</span>
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(false)}
                  className="text-stone-400 hover:text-stone-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Availability</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("all")}
                    className={`rounded-xl py-1.5 text-xs font-bold transition ${
                      availabilityFilter === "all"
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    All Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("in_stock")}
                    className={`rounded-xl py-1.5 text-xs font-bold transition ${
                      availabilityFilter === "in_stock"
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    In Stock Only
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs font-semibold text-stone-900 focus:outline-none"
                >
                  <option value="default">Default Catalog Order</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Alphabetical (A - Z)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Mode Tabs & Cashier Profile Card */}
        <div className="flex items-center gap-3">
          {/* Workstation Mode Switcher */}
          <div className="flex items-center rounded-full bg-stone-100/90 p-1 border border-stone-200/80">
            <button
              type="button"
              onClick={() => setActiveMode("register")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                activeMode === "register"
                  ? "bg-amber-800 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              New Sale
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("lookup")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                activeMode === "lookup"
                  ? "bg-amber-800 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <span>Pending Orders</span>
              {lookupResults.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-200 px-1 text-[10px] font-black text-amber-950">
                  {lookupResults.length}
                </span>
              )}
            </button>
          </div>

          {/* Cashier Profile Pill (matching Albert Flores pill in reference image) */}
          <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-stone-200/80 bg-white px-3 py-1.5 shadow-2xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-900 text-xs font-black text-white">
              {staffName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left pr-1 leading-tight">
              <p className="text-xs font-bold text-stone-900 truncate max-w-[120px]">
                {staffName}
              </p>
              <p className="text-[10px] text-stone-400 truncate max-w-[120px]">
                {staffEmail}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: NEW SALE (REGISTER)                                               */}
      {/* ========================================================================= */}
      {activeMode === "register" && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* EDITING PENDING ORDER BANNER (IF LOADED FOR EDIT) */}
          {editingPendingOrder && (
            <div className="rounded-3xl border border-amber-300 bg-amber-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-200/80 text-amber-950">
                  ☕
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-900 px-2 py-0.5 text-xs font-bold text-white">
                      {editingPendingOrder.reference_code || `REF-${editingPendingOrder.order_id}`}
                    </span>
                    <span className="text-sm font-bold text-stone-900">
                      Modifying Order: {editingPendingOrder.customer_name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Adjust items or quantities below. Changes recalculate live.
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
                className="rounded-full border border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 transition shadow-xs shrink-0"
              >
                ✕ Cancel Editing
              </button>
            </div>
          )}

          {/* MAIN 2-COLUMN LAYOUT: MENU CATALOG (LEFT) & CART DRAWER (RIGHT) */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* LEFT 7 OR 8 COLS: HORIZONTAL CATEGORIES & CARDS GRID */}
            <section className="lg:col-span-7 xl:col-span-8 space-y-5">
              {/* CATEGORY PILL SELECTOR (MATCHING REFERENCE IMAGE) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`rounded-full px-5 py-2 text-xs font-bold transition shadow-xs whitespace-nowrap ${
                    selectedCategory === "all"
                      ? "bg-amber-800 text-white"
                      : "border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  All Items ({allItems.length})
                </button>

                {catalog.map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.category_name.toLowerCase();
                  return (
                    <button
                      key={cat.category_id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.category_name)}
                      className={`rounded-full px-5 py-2 text-xs font-bold transition shadow-xs whitespace-nowrap ${
                        isSelected
                          ? "bg-amber-800 text-white"
                          : "border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {cat.category_name}
                    </button>
                  );
                })}
              </div>

              {/* SECTION HEADER (E.G. "Coffee menu") */}
              <div className="flex items-baseline justify-between pt-1">
                <h2 className="text-xl font-bold tracking-tight text-stone-900">
                  {selectedCategory === "all" ? "All Items" : `${selectedCategory} menu`}
                </h2>
                <span className="text-xs font-semibold text-stone-400">
                  {filteredItems.length} {filteredItems.length === 1 ? "drink" : "drinks"} available
                </span>
              </div>

              {/* PRODUCT CARDS 2-COLUMN GRID (MATCHING REFERENCE IMAGE) */}
              {isLoadingMenu ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="animate-pulse rounded-3xl border border-stone-200 bg-white p-5 space-y-3">
                      <div className="flex gap-4">
                        <div className="h-32 w-24 rounded-2xl bg-stone-200" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 w-3/4 rounded bg-stone-200" />
                          <div className="h-3 w-1/2 rounded bg-stone-100" />
                          <div className="h-6 w-20 rounded-full bg-stone-100 mt-4" />
                        </div>
                      </div>
                      <div className="h-8 rounded-full bg-stone-100" />
                    </div>
                  ))}
                </div>
              ) : menuError ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-8 text-center">
                  <p className="text-xs font-semibold text-rose-800">{menuError}</p>
                  <button
                    onClick={loadMenu}
                    type="button"
                    className="mt-3 rounded-full bg-stone-900 px-5 py-2 text-xs font-bold text-white shadow-xs"
                  >
                    Retry Loading Catalog
                  </button>
                </div>
              ) : filteredItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => (
                    <ProductCard
                      key={item.menu_item_id}
                      item={item}
                      onAddToCart={handleDirectAddToCart}
                      onOpenCustomizer={handleOpenCustomizer}
                      isInCart={cart.some((c) => c.menu_item_id === item.menu_item_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-500">
                  No drinks found matching &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
            </section>

            {/* RIGHT 5 OR 4 COLS: CART DRAWER (MATCHING REFERENCE IMAGE) */}
            <section className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6 rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
                {/* Cart Header */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-stone-900 tracking-tight">Cart</h2>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                      {cart.reduce((a, c) => a + c.quantity, 0)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400 font-mono">
                      Order #{orderReferenceNumber}
                    </span>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-stone-400 hover:text-rose-600 transition p-1"
                        title="Clear Cart"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {posError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                    {posError}
                  </div>
                )}

                {/* ORDER TYPE TOGGLE PILLS (Delivery / Dine in / Take away) */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100/90 rounded-full">
                  <button
                    type="button"
                    onClick={() => setOrderType("delivery")}
                    className={`rounded-full py-1.5 text-xs font-bold transition text-center ${
                      orderType === "delivery"
                        ? "bg-stone-900 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Delivery
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType("dine_in")}
                    className={`rounded-full py-1.5 text-xs font-bold transition text-center ${
                      orderType === "dine_in"
                        ? "bg-stone-900 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Dine in
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType("takeout")}
                    className={`rounded-full py-1.5 text-xs font-bold transition text-center ${
                      orderType === "takeout"
                        ? "bg-stone-900 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Take away
                  </button>
                </div>

                {/* Customer Details Inline Fields */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 p-2 text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Email (optional)"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 p-2 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* CART ITEMS LIST (MATCHING REFERENCE IMAGE) */}
                {cart.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 divide-y divide-stone-100">
                    {cart.map((item) => (
                      <div key={item.cart_id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Item Thumbnail */}
                          <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 border border-stone-100 overflow-hidden">
                            {item.image_url ? (
                              <img
                                src={getImageUrl(item.image_url)}
                                alt={item.item_name}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <DrinkIllustration className="h-10 w-8" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-bold text-stone-900 truncate">
                              {item.item_name}
                            </h4>
                            <p className="text-[11px] text-stone-400 truncate">
                              {item.size_name || "Standard"}
                              {item.addons && item.addons.length > 0 ? ` • +${item.addons.length} Addons` : ""}
                            </p>
                            <span className="font-bold text-stone-900 text-xs">
                              ₱{(item.unit_price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Stepper & Trash */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50/80 px-2 py-0.5 gap-2">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cart_id, -1)}
                              className="text-stone-500 hover:text-stone-900 font-bold px-0.5"
                            >
                              -
                            </button>
                            <span className="w-3 text-center text-xs font-black text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cart_id, 1)}
                              className="text-stone-500 hover:text-stone-900 font-bold px-0.5"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeCartItem(item.cart_id)}
                            className="text-stone-300 hover:text-rose-600 transition"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-400">
                    Your cart is currently empty.
                    <br />
                    Select a drink to add to ticket.
                  </div>
                )}

                {/* FINANCIAL TOTALS (MATCHING REFERENCE IMAGE: Items, Discounts, Total) */}
                <div className="space-y-1.5 border-t border-stone-100 pt-3 text-xs">
                  <div className="flex justify-between text-stone-400">
                    <span>Items</span>
                    <span className="font-medium text-stone-700">₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Tax (8%)</span>
                    <span className="font-medium text-stone-700">₱{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-semibold text-stone-400">Total</span>
                    <span className="text-xl font-black text-amber-800">
                      ₱{total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* CASH TENDER & CHANGE SECTION */}
                <div className="space-y-2 border-t border-stone-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`rounded-full px-3 py-1 font-bold transition ${
                          paymentMethod === "cash"
                            ? "bg-stone-900 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`rounded-full px-3 py-1 font-bold transition ${
                          paymentMethod === "card"
                            ? "bg-stone-900 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        Card
                      </button>
                    </div>

                    {paymentMethod === "cash" && (
                      <input
                        type="number"
                        step="0.01"
                        min={total}
                        value={amountTendered}
                        onChange={(e) => setAmountTendered(e.target.value)}
                        placeholder={`₱${total.toFixed(2)}`}
                        className="w-24 rounded-full border border-stone-200 bg-stone-50 p-1.5 text-right font-black text-stone-900 focus:bg-white focus:outline-none"
                      />
                    )}
                  </div>

                  {paymentMethod === "cash" && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAmountTendered(total.toFixed(2))}
                          className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700 hover:bg-stone-200"
                        >
                          Exact
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountTendered("100.00")}
                          className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700 hover:bg-stone-200"
                        >
                          ₱100
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountTendered("500.00")}
                          className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700 hover:bg-stone-200"
                        >
                          ₱500
                        </button>
                      </div>

                      <div className="font-bold text-emerald-800">
                        Change: ₱{registerChangeDue.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* BIG ROUNDED ACTION BUTTON (MATCHING "Place an order" BUTTON) */}
                <button
                  type="button"
                  disabled={cart.length === 0 || isSubmitting || (paymentMethod === "cash" && amountTendered && numericTendered < total)}
                  onClick={handleCheckout}
                  className="w-full rounded-full bg-amber-800 py-3.5 text-sm font-black text-white shadow-md transition-all hover:bg-amber-900 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
                >
                  {isSubmitting ? "Processing..." : "Place an order"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: LOOK UP PENDING COUNTER ORDERS                                    */}
      {/* ========================================================================= */}
      {activeMode === "lookup" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* LEFT 7 COLS: PENDING ORDERS LIST */}
            <section className="lg:col-span-7 space-y-4">
              {/* Lookup Search Input */}
              <div className="rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">
                    Pending Pickup Tickets
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                    {lookupResults.length} waiting
                  </span>
                </div>

                <form onSubmit={handleLookupSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Search by REF-XXXX, order #, or customer name..."
                    className="flex-1 rounded-full border border-stone-200 bg-stone-50 py-2 px-4 text-xs font-semibold focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingLookup}
                    className="rounded-full bg-stone-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-stone-800 transition"
                  >
                    {isSearchingLookup ? "Searching..." : "Search"}
                  </button>
                </form>
              </div>

              {lookupError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
                  {lookupError}
                </div>
              )}

              {/* Pending Orders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {lookupResults.map((order) => {
                  const isSelected = selectedPendingOrder?.order_id === order.order_id;
                  return (
                    <button
                      key={order.order_id}
                      type="button"
                      onClick={() => handleSelectPendingOrder(order)}
                      className={`text-left rounded-3xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? "border-amber-800 bg-amber-50/50 shadow-md ring-2 ring-amber-300"
                          : "border-stone-200/90 bg-white hover:border-amber-700/40 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-stone-900 px-3 py-1 font-mono text-xs font-bold text-white">
                            {order.reference_code || `REF-${order.order_id}`}
                          </span>
                          <span className="text-xs font-bold text-amber-900">
                            ₱{Number(order.total_amount).toFixed(2)}
                          </span>
                        </div>

                        <h4 className="mt-3 font-bold text-stone-900 text-sm">
                          {order.customer_name}
                        </h4>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {order.items?.length || 0} drinks • {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-500">Status: {order.status}</span>
                        <span className="font-bold text-amber-800">Select Order →</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {lookupResults.length === 0 && !isSearchingLookup && (
                <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-400">
                  No pending counter orders found.
                </div>
              )}
            </section>

            {/* RIGHT 5 COLS: SELECTED ORDER PAYMENT PANEL */}
            <section className="lg:col-span-5">
              <div className="sticky top-6 rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-stone-900">
                      {selectedPendingOrder ? `Order #${selectedPendingOrder.order_id}` : "Select an Order"}
                    </h3>
                    {selectedPendingOrder && (
                      <p className="text-xs font-bold text-amber-900">
                        {selectedPendingOrder.customer_name} ({selectedPendingOrder.reference_code})
                      </p>
                    )}
                  </div>
                  {selectedPendingOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        // Load into full register for editing
                        setEditingPendingOrder(selectedPendingOrder);
                        setCart(pendingItems);
                        setCustomerName(selectedPendingOrder.customer_name);
                        setActiveMode("register");
                      }}
                      className="rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold hover:bg-amber-200 transition"
                    >
                      Edit in Register
                    </button>
                  )}
                </div>

                {selectedPendingOrder ? (
                  <>
                    {/* Add extra drink toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAddDrinkDropdown((v) => !v)}
                        className="w-full rounded-2xl border border-dashed border-amber-800/40 p-2.5 text-xs font-bold text-amber-900 hover:bg-amber-50/60 transition"
                      >
                        + Add Another Drink to This Ticket
                      </button>

                      {showAddDrinkDropdown && (
                        <div className="absolute left-0 right-0 mt-2 z-20 max-h-56 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-xl space-y-2">
                          <input
                            type="text"
                            value={addDrinkSearch}
                            onChange={(e) => setAddDrinkSearch(e.target.value)}
                            placeholder="Type drink name..."
                            className="w-full rounded-xl border border-stone-200 p-2 text-xs font-semibold focus:outline-none"
                          />
                          <div className="divide-y divide-stone-100">
                            {allItems
                              .filter((it) => !addDrinkSearch || it.item_name.toLowerCase().includes(addDrinkSearch.toLowerCase()))
                              .map((it) => (
                                <button
                                  key={it.menu_item_id}
                                  type="button"
                                  onClick={() => {
                                    handleDirectAddToCart({ item: it, size: it.sizes?.[0], quantity: 1 });
                                    setShowAddDrinkDropdown(false);
                                  }}
                                  className="w-full py-2 px-1 text-left text-xs font-bold text-stone-900 hover:bg-amber-50 flex justify-between"
                                >
                                  <span>{it.item_name}</span>
                                  <span className="text-amber-800">₱{Number(it.base_price).toFixed(2)}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pending Order Items List */}
                    <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 border-y border-stone-100 my-2">
                      {pendingItems.map((item) => (
                        <div key={item.cart_id} className="py-2.5 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <h4 className="font-bold text-stone-900 truncate">{item.item_name}</h4>
                            <p className="text-[11px] text-stone-400">
                              {item.size_name || "Regular"}
                              {item.addons?.length > 0 ? ` • +${item.addons.length} Addons` : ""}
                            </p>
                            <span className="font-bold text-stone-900">₱{(item.unit_price * item.quantity).toFixed(2)}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 gap-2">
                              <button
                                type="button"
                                onClick={() => updatePendingItemQuantity(item.cart_id, -1)}
                                className="text-stone-500 hover:text-stone-900 font-bold"
                              >
                                -
                              </button>
                              <span className="w-3 text-center font-black">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updatePendingItemQuantity(item.cart_id, 1)}
                                className="text-stone-500 hover:text-stone-900 font-bold"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingItem(item.cart_id)}
                              className="text-stone-300 hover:text-rose-600 transition"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pending Order Totals */}
                    <div className="space-y-1.5 text-xs border-b border-stone-100 pb-3">
                      <div className="flex justify-between text-stone-400">
                        <span>Items Subtotal</span>
                        <span>₱{pendingSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-stone-400">
                        <span>Tax (8%)</span>
                        <span>₱{pendingTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="font-semibold text-stone-400">Total Due</span>
                        <span className="text-xl font-black text-amber-800">
                          ₱{pendingTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Payment Options */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCounterPaymentMethod("cash")}
                            className={`rounded-full px-3 py-1 font-bold transition ${
                              counterPaymentMethod === "cash"
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            Cash
                          </button>
                          <button
                            type="button"
                            onClick={() => setCounterPaymentMethod("card")}
                            className={`rounded-full px-3 py-1 font-bold transition ${
                              counterPaymentMethod === "card"
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            Card
                          </button>
                        </div>

                        {counterPaymentMethod === "cash" && (
                          <input
                            type="number"
                            step="0.01"
                            min={pendingTotal}
                            value={counterAmountTendered}
                            onChange={(e) => setCounterAmountTendered(e.target.value)}
                            placeholder={`₱${pendingTotal.toFixed(2)}`}
                            className="w-24 rounded-full border border-stone-200 bg-stone-50 p-1.5 text-right font-black text-stone-900 focus:bg-white focus:outline-none"
                          />
                        )}
                      </div>

                      {counterPaymentMethod === "cash" && (
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <button
                            type="button"
                            onClick={() => setCounterAmountTendered(pendingTotal.toFixed(2))}
                            className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700 hover:bg-stone-200"
                          >
                            Exact
                          </button>
                          <div className="font-bold text-emerald-800">
                            Change: ₱{counterChangeDue.toFixed(2)}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isSubmitting || pendingItems.length === 0}
                        onClick={handleConfirmCounterPayment}
                        className="w-full rounded-full bg-amber-800 py-3.5 text-sm font-black text-white shadow-md transition-all hover:bg-amber-900 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting ? "Processing..." : "Confirm Payment & Print Receipt"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-xs text-stone-400">
                    Select a pending ticket from the list on the left to review items and tender payment.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMIZE ITEM MODAL                                                      */}
      {/* ========================================================================= */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">{customizingItem.item_name}</h3>
                <span className="text-xs text-amber-800 font-bold">
                  Base Price: ₱{Number(customizingItem.base_price).toFixed(2)}
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
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex justify-between transition ${
                        selectedSize?.menu_item_size_id === s.menu_item_size_id
                          ? "border-amber-800 bg-amber-50 text-amber-950 ring-2 ring-amber-300"
                          : "border-stone-200 text-stone-700 hover:bg-stone-50"
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
                  Add-ons & Options
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {customizingItem.addons.map((a) => {
                    const isChecked = selectedAddons.some((x) => x.menu_item_addon_id === a.menu_item_addon_id);
                    return (
                      <label
                        key={a.menu_item_addon_id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs font-bold cursor-pointer transition ${
                          isChecked ? "border-amber-800 bg-amber-50 text-amber-950" : "border-stone-200 text-stone-700"
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
                        <span className="text-amber-800">+₱{Number(a.additional_price).toFixed(2)}</span>
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
                placeholder="e.g. Extra hot, oat milk, less ice"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-stone-200 p-2.5 text-xs font-semibold focus:outline-none focus:border-amber-800"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="rounded-full border border-stone-300 px-5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomizedToCart}
                className="rounded-full bg-amber-800 px-6 py-2 text-xs font-black text-white hover:bg-amber-900 shadow-md"
              >
                Add to Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POS RECEIPT CONFIRMATION DIALOG                                           */}
      {/* ========================================================================= */}
      {confirmedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-3 sm:p-5 md:p-6 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg md:max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/80 px-6 py-3.5 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-800 shadow-xs">
                  ✓
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Payment Confirmed!</h3>
                  <p className="text-xs text-stone-500">
                    Order #{confirmedReceipt.order_id} sent to Barista Queue.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedReceipt(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left Column: Transaction Details & Actions */}
                <div className="md:col-span-6 lg:col-span-5 space-y-4">
                  {/* Single-Use Pickup Code Box */}
                  <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100/50 p-4 text-center shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider block">
                      Single-Use Pickup Code
                    </span>
                    <span className="text-3xl sm:text-4xl font-black tracking-widest text-amber-950 block mt-0.5 font-mono">
                      {confirmedReceipt.pickup_code}
                    </span>
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-xs space-y-2">
                    <div className="flex justify-between text-stone-600">
                      <span>Customer:</span>
                      <span className="font-bold text-stone-900 truncate max-w-[180px]">
                        {confirmedReceipt.customer_name || "Walk-in Guest"}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Cashier:</span>
                      <span className="font-medium text-stone-800">{staffName}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Order Type:</span>
                      <span className="font-bold text-stone-900 uppercase text-[11px]">
                        {(confirmedReceipt.order_channel || "in_store").replace("_", " ")} • {(confirmedReceipt.order_type || "dine_in").replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600 border-t border-stone-200/70 pt-2">
                      <span>Total Paid:</span>
                      <span className="font-extrabold text-stone-900 text-sm">
                        ₱{Number(confirmedReceipt.total_amount).toFixed(2)}
                      </span>
                    </div>
                    {confirmedReceipt.amount_tendered && (
                      <div className="flex justify-between text-stone-600">
                        <span>Cash Tendered:</span>
                        <span className="font-mono font-medium">
                          ₱{Number(confirmedReceipt.amount_tendered).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {confirmedReceipt.change_due !== null && confirmedReceipt.change_due !== undefined && (
                      <div className="flex justify-between items-center font-black text-emerald-800 border-t border-stone-200/70 pt-2">
                        <span className="text-xs">Change Given:</span>
                        <span className="font-mono text-base font-black text-emerald-900">
                          ₱{Number(confirmedReceipt.change_due).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Printing Controls & Next Sale Action */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={printThermalReceipt}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-xs font-bold text-white shadow-xs hover:bg-black transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Print Thermal Receipt</span>
                    </button>

                    {confirmedReceipt.receipt_pdf_url && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => printReceipt(confirmedReceipt.receipt_pdf_url)}
                          className="flex items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-white py-2 text-xs font-bold text-stone-800 hover:bg-stone-50 transition"
                        >
                          Print PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadReceipt(confirmedReceipt.receipt_pdf_url, confirmedReceipt.order_id)}
                          className="flex items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-white py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 transition"
                        >
                          Download PDF
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmedReceipt(null)}
                      className="w-full rounded-full border border-stone-300 bg-white py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 transition shadow-2xs"
                    >
                      Next Customer / New Sale
                    </button>
                  </div>
                </div>

                {/* Right Column: Thermal Receipt Preview */}
                <div className="md:col-span-6 lg:col-span-7 flex flex-col space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Official Thermal Receipt
                    </span>
                    <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-bold text-stone-600 font-mono">
                      80mm Standard Roll
                    </span>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-100/80 p-3 sm:p-5 max-h-[500px] overflow-y-auto shadow-inner flex justify-center">
                    <ThermalReceipt order={confirmedReceipt} staffName={staffName} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
