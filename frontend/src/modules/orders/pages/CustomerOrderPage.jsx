import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchMenuCatalog } from "../../menu/api/menuApi";
import { getImageUrl } from "../../menu/utils/image";
import { submitCustomerOrder } from "../api/ordersApi";
import { downloadReceipt } from "../utils/receiptUtils";

export default function CustomerOrderPage() {
  const location = useLocation();
  const [catalog, setCatalog] = useState([]);
  const [autoSelectedMessage, setAutoSelectedMessage] = useState(() => {
    if (location.state?.preselected?.item) {
      return `✓ "${location.state.preselected.item.item_name}" selected and added to your order!`;
    }
    return "";
  });
  const [cart, setCart] = useState(() => {
    if (location.state?.preselected?.item) {
      const { item, size, addons } = location.state.preselected;
      return [
        {
          cartId: `${item.menu_item_id}-${Date.now()}-${Math.random()}`,
          item,
          size: size || (item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null),
          addons: addons || [],
          special_instructions: null,
          quantity: 1,
        },
      ];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Checkout form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState("takeout");
  const [paymentMethodIntent, setPaymentMethodIntent] = useState("pay_at_counter"); // "pay_at_counter" is active mode
  const [paymentWarning, setPaymentWarning] = useState("");

  // Customization selection modal
  const [customizingItem, setCustomizingItem] = useState(null);
  const [modalSize, setModalSize] = useState(null);
  const [modalAddons, setModalAddons] = useState([]);
  const [modalNote, setModalNote] = useState("");

  // Flow states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  async function loadCatalog() {
    setIsLoading(true);
    setCatalogError("");
    try {
      const data = await fetchMenuCatalog();
      setCatalog(data);
    } catch (err) {
      console.error("Failed to load catalog:", err);
      setCatalogError("Unable to load the menu catalog. Please check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  // Listen for navigation with preselected item from Browse
  useEffect(() => {
    if (location.state?.preselected?.item) {
      const { item, size, addons } = location.state.preselected;
      const selectedSize = size || (item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null);

      setCart((prev) => {
        const alreadyHas = prev.some((c) => c.item.menu_item_id === item.menu_item_id);
        if (alreadyHas) return prev;
        return [
          ...prev,
          {
            cartId: `${item.menu_item_id}-${Date.now()}-${Math.random()}`,
            item,
            size: selectedSize,
            addons: addons || [],
            special_instructions: null,
            quantity: 1,
          },
        ];
      });

      setAutoSelectedMessage(`✓ "${item.item_name}" selected and added to your order!`);
      const timer = setTimeout(() => setAutoSelectedMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.key, location.state]);

  // Handle URL search parameter ?item_id=... once catalog is loaded
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qItemId = params.get("item_id");
    if (!qItemId || catalog.length === 0) return;

    const allItems = catalog.flatMap((c) => c.items || []);
    const matched = allItems.find((it) => it.menu_item_id.toString() === qItemId.toString());
    if (matched) {
      setCart((prev) => {
        const alreadyHas = prev.some((c) => c.item.menu_item_id === matched.menu_item_id);
        if (alreadyHas) return prev;
        const defaultSize = matched.sizes?.find((s) => s.is_default) || matched.sizes?.[0] || null;
        return [
          ...prev,
          {
            cartId: `${matched.menu_item_id}-${Date.now()}-${Math.random()}`,
            item: matched,
            size: defaultSize,
            addons: [],
            special_instructions: null,
            quantity: 1,
          },
        ];
      });

      setAutoSelectedMessage(`✓ "${matched.item_name}" selected and added to your order!`);
      const timer = setTimeout(() => setAutoSelectedMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.search, catalog]);

  function handleOpenCustomize(item) {
    setCustomizingItem(item);
    const defSize = item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null;
    setModalSize(defSize);
    setModalAddons([]);
    setModalNote("");
  }

  function handleAddToCart() {
    if (!customizingItem) return;

    setCart((prev) => [
      ...prev,
      {
        cartId: `${customizingItem.menu_item_id}-${Date.now()}-${Math.random()}`,
        item: customizingItem,
        size: modalSize,
        addons: modalAddons,
        special_instructions: modalNote.trim() || null,
        quantity: 1,
      },
    ]);
    setCustomizingItem(null);
  }

  function updateQuantity(cartId, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.cartId === cartId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean)
    );
  }

  const subtotal = cart.reduce((sum, entry) => {
    let itemPrice = Number(entry.item.base_price);
    if (entry.size) itemPrice += Number(entry.size.price_adjustment);
    const addonPrice = entry.addons.reduce((aSum, a) => aSum + Number(a.additional_price), 0);
    return sum + (itemPrice + addonPrice) * entry.quantity;
  }, 0);

  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  async function handleCheckout(e) {
    e.preventDefault();
    setOrderError("");

    if (cart.length === 0) {
      setOrderError("Your cart is empty. Please select a drink to order.");
      return;
    }

    if (!email.trim() || !firstName.trim()) {
      setOrderError("Please provide your name and email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit order
      const orderPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        phone_number: phone.trim() || null,
        order_type: orderType,
        payment_method_intent: paymentMethodIntent,
        items: cart.map((c) => ({
          menu_item_id: c.item.menu_item_id,
          menu_item_size_id: c.size ? c.size.menu_item_size_id : null,
          quantity: c.quantity,
          special_instructions: c.special_instructions,
          addons: c.addons.map((a) => ({
            menu_item_addon_id: a.menu_item_addon_id,
            quantity: 1,
          })),
        })),
      };

      // Online card and e-wallet are not yet integrated; require pay_at_counter
      if (paymentMethodIntent !== "pay_at_counter") {
        setOrderError("⚠️ Online Card and E-Wallet payments are not yet integrated into our system. Please select 'Pay at Counter' to place your order.");
        setIsSubmitting(false);
        return;
      }

      const createdOrder = await submitCustomerOrder(orderPayload);
      setConfirmedOrder(createdOrder);
      setCart([]);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 409 || (detail && detail.toLowerCase().includes("stock"))) {
        setOrderError("⚠️ Item Sold Out: One of the selected drinks just sold out. Please remove it and select another item.");
      } else if (status === 400 && detail && detail.toLowerCase().includes("expired")) {
        setOrderError("⏳ Reservation Expired: Your hold has elapsed. Please re-submit your order.");
      } else if (status === 429) {
        setOrderError("🛑 High Traffic Rate Limit: Too many order attempts. Please wait a moment before trying again.");
      } else if (status === 403) {
        setOrderError("Unable to process this order online. Please order in-person at the counter.");
      } else {
        setOrderError(detail || "Unable to complete order. Please check your details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter items
  const allItems = catalog.flatMap((c) => c.items.map((i) => ({ ...i, category_name: c.category_name })));
  const filteredCatalog = catalog
    .map((c) => ({
      ...c,
      items: selectedCategory === "all" || c.category_name.toLowerCase() === selectedCategory.toLowerCase() ? c.items : [],
    }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-stone-200 bg-white/95 px-6 backdrop-blur sm:px-12">
        <div className="flex items-center gap-3">
          <Link className="flex items-center gap-2 text-xl font-black text-amber-950" to="/">
            <span>☕</span>
            <span>ldrn&apos;s coffee</span>
          </Link>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            Online Ordering
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link className="text-stone-600 hover:text-amber-950" to="/browse">
            Browse Menu 📖
          </Link>
          <Link className="text-stone-600 hover:text-amber-950" to="/track">
            Track Order 🔍
          </Link>
          <Link className="rounded-xl bg-stone-900 px-4 py-2 text-white hover:bg-stone-800" to="/login">
            Staff Portal →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* AUTO-SELECTED DRINK FROM BROWSE FEEDBACK BANNER */}
        {autoSelectedMessage && !confirmedOrder && (
          <div className="mb-6 flex items-center justify-between rounded-3xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs font-bold text-emerald-950 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-800">
                ☕
              </span>
              <div>
                <span className="text-sm font-black text-emerald-950 block">
                  {autoSelectedMessage}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800/90">
                  Your drink is ready in the order ticket below. Review your selections and choose your payment method.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoSelectedMessage("")}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition"
            >
              Got it ✓
            </button>
          </div>
        )}

        {/* CONFIRMATION BANNER / RECEIPT (COUNTER REFERENCE or PAID PICKUP CODE) */}
        {confirmedOrder && (
          <div className="mb-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in duration-200">
            {(confirmedOrder.payment_method_intent === "pay_at_counter" || confirmedOrder.order_status === "awaiting_payment" || confirmedOrder.reference_code) ? (
              /* PAY AT COUNTER CONFIRMATION */
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-100 pb-6">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-950">
                      🏪
                    </span>
                    <div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                        Pay at Counter • Reservation Active
                      </span>
                      <h2 className="text-xl font-black text-stone-900 sm:text-2xl mt-1">
                        Order #{confirmedOrder.order_id} Reserved!
                      </h2>
                      <p className="text-xs text-stone-500">
                        Held for 24 hours (1 Day) • Please present code at the counter upon arrival
                      </p>
                    </div>
                  </div>

                  {/* REFERENCE CODE WITH QUICK COPY */}
                  <div className="rounded-2xl border-2 border-amber-600 bg-amber-50/90 p-4 text-center shadow-md min-w-[220px]">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                      Your Reference Code
                    </span>
                    <span className="text-3xl font-black tracking-widest text-amber-950 block mt-1 select-all">
                      {confirmedOrder.reference_code || `REF-${confirmedOrder.order_id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = confirmedOrder.reference_code || `REF-${confirmedOrder.order_id}`;
                        navigator.clipboard?.writeText(code);
                        alert(`Copied Reference Code: ${code}`);
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-black text-amber-950 hover:bg-amber-300 transition"
                    >
                      <span>📋</span>
                      <span>Copy Code</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-xs text-stone-700 space-y-1.5 border border-stone-200">
                  <span className="font-extrabold text-stone-900 block">
                    📍 What to do next:
                  </span>
                  <p>
                    1. Head to the store counter and give your Reference Code <strong>{confirmedOrder.reference_code || `REF-${confirmedOrder.order_id}`}</strong> to the cashier.
                  </p>
                  <p>
                    2. The cashier will look up your order on the POS register, adjust any items/sizes if you wish, and process payment (Cash or Card).
                  </p>
                  <p>
                    3. As soon as payment is confirmed, your order is dispatched immediately to the Barista Queue for fresh preparation!
                  </p>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <span className="font-bold text-stone-500">
                    Estimated Total Due at Counter: <strong className="text-stone-900">₱{Number(confirmedOrder.total_amount).toFixed(2)}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/track?order_id=${confirmedOrder.order_id}&email=${encodeURIComponent(confirmedOrder.customer_email || email)}`}
                      className="rounded-xl bg-amber-900 px-4 py-2 font-bold text-white hover:bg-amber-950 transition"
                    >
                      Track Order Status 🔍
                    </Link>
                    <button
                      onClick={() => setConfirmedOrder(null)}
                      className="rounded-xl border border-stone-300 bg-white px-4 py-2 font-bold text-stone-700 hover:bg-stone-100"
                    >
                      New Order
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ONLINE PAID ORDER CONFIRMATION */
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-100 pb-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">
                      ✓
                    </span>
                    <div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-900">
                        Paid Online • Confirmed
                      </span>
                      <h2 className="text-xl font-black text-emerald-950 sm:text-2xl mt-1">
                        Payment Received &amp; Brewing Fresh!
                      </h2>
                      <p className="text-xs text-emerald-800">
                        Order #{confirmedOrder.order_id} • Sent to Barista Station
                      </p>
                    </div>
                  </div>

                  {/* SINGLE-USE PICKUP CODE */}
                  <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 p-4 text-center shadow-md min-w-[200px]">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 block">
                      Single-Use Pickup Code
                    </span>
                    <span className="text-3xl font-black tracking-widest text-emerald-950 block mt-1">
                      {confirmedOrder.pickup_code}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-emerald-900">
                  <span>Show this pickup code to the barista counter when picking up your drinks.</span>
                  <div className="flex items-center gap-2">
                    {confirmedOrder.receipt_pdf_url && (
                      <button
                        type="button"
                        onClick={() => downloadReceipt(confirmedOrder.receipt_pdf_url, confirmedOrder.order_id)}
                        className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 font-bold text-emerald-950 hover:bg-emerald-50 transition"
                      >
                        📄 Download Receipt
                      </button>
                    )}
                    <Link
                      to={`/track?order_id=${confirmedOrder.order_id}&email=${encodeURIComponent(confirmedOrder.customer_email || email)}`}
                      className="rounded-xl bg-emerald-900 px-4 py-2 font-bold text-white hover:bg-emerald-950 transition"
                    >
                      Live Order Tracker →
                    </Link>
                    <button
                      onClick={() => setConfirmedOrder(null)}
                      className="rounded-xl border border-emerald-300 bg-white px-4 py-2 font-bold text-emerald-900 hover:bg-emerald-100"
                    >
                      New Order
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE: MENU ITEMS ON LEFT, CART & CHECKOUT ON RIGHT */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* LEFT 7 COLS: MENU CATALOG WITH CATEGORY FILTER */}
          <section className="lg:col-span-7 space-y-6">
            {/* Category Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedCategory === "all"
                    ? "bg-amber-900 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                All Menu ({allItems.length})
              </button>
              {catalog.map((cat) => (
                <button
                  key={cat.category_id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.category_name)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedCategory.toLowerCase() === cat.category_name.toLowerCase()
                      ? "bg-amber-900 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {cat.category_name} ({cat.items.length})
                </button>
              ))}
            </div>

            {/* CATALOG LIST */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
                    <div className="h-5 w-32 rounded bg-stone-200" />
                    <div className="h-20 w-full rounded-2xl bg-stone-100" />
                  </div>
                ))}
              </div>
            ) : catalogError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
                <span className="text-3xl">⚠️</span>
                <p className="mt-2 text-xs font-bold text-rose-800">{catalogError}</p>
                <button
                  onClick={loadCatalog}
                  type="button"
                  className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white"
                >
                  Retry
                </button>
              </div>
            ) : filteredCatalog.length > 0 ? (
              filteredCatalog.map((cat) => (
                <div key={cat.category_id} className="space-y-3">
                  <h3 className="text-base font-extrabold text-stone-900">{cat.category_name}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cat.items.map((item) => (
                      <div
                        key={item.menu_item_id}
                        className="flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200 bg-white p-4 shadow-xs transition hover:border-amber-400 hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-stone-100 border border-stone-200">
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

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-bold text-stone-900 text-sm">{item.item_name}</h4>
                              <span className="font-black text-amber-950 text-xs shrink-0">
                                ₱{Number(item.base_price).toFixed(2)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">
                              {item.description || "Handcrafted fresh to order."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
                          <span className="text-[10px] font-bold text-emerald-700">● In Stock</span>
                          <button
                            type="button"
                            onClick={() => handleOpenCustomize(item)}
                            className="rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-950 transition"
                          >
                            + Select &amp; Customize
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-500">
                No menu items available in this category.
              </div>
            )}
          </section>

          {/* RIGHT 5 COLS: CART & CHECKOUT FORM */}
          <section className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4 sticky top-28">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-base font-black text-stone-900">
                  Your Order Cart ({cart.reduce((a, c) => a + c.quantity, 0)})
                </h3>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-stone-400 hover:text-rose-700"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* 10-MINUTE RESERVATION NOTICE */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-0.5">
                <span className="font-extrabold flex items-center gap-1">
                  <span>⏱️</span> 10-Minute Hold Guarantee
                </span>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  Upon placing your order, ingredients are reserved for 10 minutes while payment completes.
                </p>
              </div>

              {/* CART ITEMS LIST */}
              {cart.length > 0 ? (
                <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 border-y border-stone-100">
                  {cart.map((entry) => (
                    <div key={entry.cartId} className="py-3 flex items-start justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-stone-900">
                          {entry.item.item_name}{" "}
                          {entry.size && (
                            <span className="text-[11px] font-semibold text-stone-500">
                              ({entry.size.size_name})
                            </span>
                          )}
                        </div>
                        {entry.addons.length > 0 && (
                          <div className="text-[10px] text-stone-500">
                            + {entry.addons.map((a) => a.addon_name).join(", ")}
                          </div>
                        )}
                        {entry.special_instructions && (
                          <div className="text-[10px] text-amber-900 italic">
                            Note: {entry.special_instructions}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(entry.cartId, -1)}
                          className="h-6 w-6 rounded-lg bg-stone-100 font-bold hover:bg-stone-200"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold">{entry.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(entry.cartId, 1)}
                          className="h-6 w-6 rounded-lg bg-stone-100 font-bold hover:bg-stone-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* EMPTY CART STATE */
                <div className="py-8 text-center text-xs text-stone-500 border border-dashed border-stone-200 rounded-2xl space-y-2">
                  <span className="text-2xl block">🛒</span>
                  <p className="font-bold text-stone-800">Your cart is empty</p>
                  <p className="text-[11px] text-stone-400">
                    Add something from the menu to get started.
                  </p>
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
                  <span>Total</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>

              {/* CHECKOUT FORM */}
              <form onSubmit={handleCheckout} className="space-y-3 text-xs">
                {orderError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">
                    {orderError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700">Email Address (for Receipt &amp; Pickup Code) *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700">Dining Option</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType("takeout")}
                      className={`p-2 rounded-xl border text-xs font-bold transition ${
                        orderType === "takeout"
                          ? "border-amber-900 bg-amber-50 text-amber-950 ring-1 ring-amber-900"
                          : "border-stone-200 text-stone-700 bg-white"
                      }`}
                    >
                      🛍️ Takeout
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("dine_in")}
                      className={`p-2 rounded-xl border text-xs font-bold transition ${
                        orderType === "dine_in"
                          ? "border-amber-900 bg-amber-50 text-amber-950 ring-1 ring-amber-900"
                          : "border-stone-200 text-stone-700 bg-white"
                      }`}
                    >
                      🍽️ Dine-In
                    </button>
                  </div>
                </div>

                {/* PAYMENT METHOD TILES */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-stone-700">Payment Method</label>
                    <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                      In-Store Counter Payment
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {/* PAY AT COUNTER (ACTIVE) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethodIntent("pay_at_counter");
                        setPaymentWarning("");
                      }}
                      className="col-span-1 flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition border-amber-900 bg-amber-50/90 text-amber-950 ring-2 ring-amber-400 shadow-xs"
                    >
                      <span className="text-base">🏪</span>
                      <span className="text-[10px] font-black mt-1">Pay at Counter</span>
                      <span className="text-[8px] text-amber-800 font-bold">1-Day Hold</span>
                    </button>

                    {/* ONLINE CARD (NOT INTEGRATED) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentWarning("Card online payment is not yet integrated. Please select 'Pay at Counter' — you can still pay with Card or Cash when you arrive at the store counter!");
                      }}
                      className="opacity-60 hover:opacity-85 flex flex-col items-center justify-center p-2.5 rounded-2xl border border-stone-200 bg-stone-100 text-stone-500 text-center transition"
                    >
                      <span className="text-base">💳</span>
                      <span className="text-[10px] font-black mt-1 line-through">Card</span>
                      <span className="text-[8px] text-rose-700 font-bold">Not Integrated</span>
                    </button>

                    {/* ONLINE EWALLET (NOT INTEGRATED) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentWarning("E-Wallet online payment is not yet integrated. Please select 'Pay at Counter' — you can still pay with GCash, Maya, Card, or Cash at the store counter!");
                      }}
                      className="opacity-60 hover:opacity-85 flex flex-col items-center justify-center p-2.5 rounded-2xl border border-stone-200 bg-stone-100 text-stone-500 text-center transition"
                    >
                      <span className="text-base">📱</span>
                      <span className="text-[10px] font-black mt-1 line-through">E-Wallet</span>
                      <span className="text-[8px] text-rose-700 font-bold">Not Integrated</span>
                    </button>
                  </div>

                  {paymentWarning && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] font-bold text-amber-900 flex items-start justify-between gap-2 animate-in fade-in duration-150">
                      <span>⚠️ {paymentWarning}</span>
                      <button type="button" onClick={() => setPaymentWarning("")} className="text-stone-400 hover:text-stone-700">✕</button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full rounded-2xl bg-amber-900 py-3.5 text-xs font-black text-white shadow-md hover:bg-amber-950 disabled:opacity-50 transition"
                >
                  {isSubmitting
                    ? "Securing Order..."
                    : `Reserve & Pay at Counter (₱${total.toFixed(2)}) 🏪`}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>

      {/* CUSTOMIZE MODAL */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">{customizingItem.item_name}</h3>
                <span className="text-xs text-amber-950 font-bold">
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
                  Select Size
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.sizes.map((s) => (
                    <button
                      key={s.menu_item_size_id}
                      type="button"
                      onClick={() => setModalSize(s)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex justify-between ${
                        modalSize?.menu_item_size_id === s.menu_item_size_id
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
                  Add-on Modifiers
                </label>
                <div className="space-y-1.5">
                  {customizingItem.addons.map((a) => {
                    const isChecked = modalAddons.some((x) => x.menu_item_addon_id === a.menu_item_addon_id);
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
                                setModalAddons((prev) => [...prev, a]);
                              } else {
                                setModalAddons((prev) =>
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
              <label className="text-xs font-bold text-stone-700 block">Drink Preparation Notes</label>
              <input
                type="text"
                placeholder="e.g. Less ice, oat milk"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
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
                onClick={handleAddToCart}
                className="rounded-xl bg-amber-900 px-5 py-2 text-xs font-black text-white hover:bg-amber-800 shadow-md"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
