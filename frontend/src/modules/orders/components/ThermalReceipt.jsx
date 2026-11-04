import { useMemo } from "react";

export default function ThermalReceipt({ order, staffName = "Counter Register" }) {
  const storeProfile = useMemo(() => {
    try {
      const saved = localStorage.getItem("coffee_shop_store_profile");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      storeName: "ldrn's coffee",
      tagline: "Artisan Brews & Espresso Bar",
      contactNumber: "+63 (912) 345-6789",
      storeAddress: "Unit 4B Ground Floor, Aurora Plaza",
    };
  }, []);

  if (!order) return null;

  const orderDateStr = order.order_date
    ? new Date(order.order_date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount_amount || 0);
  const tax = Number(order.tax_amount || 0);
  const total = Number(order.total_amount || 0);
  const tendered = order.amount_tendered !== null && order.amount_tendered !== undefined ? Number(order.amount_tendered) : null;
  const change = order.change_due !== null && order.change_due !== undefined ? Number(order.change_due) : null;

  return (
    <div
      id="pos-thermal-receipt-container"
      className="receipt-thermal-paper font-mono text-[11px] leading-tight text-stone-900 bg-white p-4 sm:p-5 w-full max-w-[340px] mx-auto border border-stone-200/90 rounded-xl shadow-md select-text"
    >
      {/* Thermal Store Header */}
      <div className="text-center space-y-0.5 pb-2">
        <div className="text-lg font-black tracking-tight flex items-center justify-center gap-1">
          <span>☕</span>
          <span>{storeProfile.storeName || "ldrn's coffee"}</span>
        </div>
        <div className="text-[10px] text-stone-600 font-sans">
          {storeProfile.tagline || "Artisan Brews & Espresso Bar"}
        </div>
        <div className="text-[9px] text-stone-500 font-sans">
          {storeProfile.storeAddress}
        </div>
        {storeProfile.contactNumber && (
          <div className="text-[9px] text-stone-500 font-sans">
            Tel: {storeProfile.contactNumber}
          </div>
        )}
        <div className="text-[9px] text-stone-500 uppercase tracking-widest font-sans font-bold pt-1">
          Official Customer Receipt
        </div>
      </div>

      <div className="border-t border-dashed border-stone-400 my-2" />

      {/* Pickup Code Box */}
      {order.pickup_code && (
        <div className="text-center py-1.5 border border-stone-300 rounded bg-stone-50 my-2">
          <div className="text-[9px] font-sans font-extrabold uppercase tracking-wider text-stone-600">
            Single-Use Pickup Code
          </div>
          <div className="text-2xl font-black tracking-widest text-amber-950 font-mono mt-0.5">
            {order.pickup_code}
          </div>
        </div>
      )}

      {/* Order Metadata */}
      <div className="space-y-0.5 text-[10px] text-stone-700">
        <div className="flex justify-between">
          <span className="font-bold">Order #:</span>
          <span>{order.order_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Date:</span>
          <span>{orderDateStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Customer:</span>
          <span className="truncate max-w-[160px]">{order.customer_name || "Walk-in Guest"}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Cashier:</span>
          <span>{staffName || "Counter Register"}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Type:</span>
          <span className="uppercase">
            {(order.order_channel || "in_store").replace("_", " ")} • {(order.order_type || "dine_in").replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="border-t border-dashed border-stone-400 my-2" />

      {/* Line Items Table */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-bold border-b border-stone-200 pb-1">
          <span className="w-1/2">Item</span>
          <span className="w-1/6 text-center">Qty</span>
          <span className="w-1/3 text-right">Amount</span>
        </div>

        {(order.items && order.items.length > 0) ? (
          order.items.map((item, idx) => {
            const itemPrice = Number(item.subtotal || 0);
            return (
              <div key={item.order_item_id || idx} className="text-[10px] space-y-0.5">
                <div className="flex justify-between items-start">
                  <div className="w-1/2 font-bold leading-tight text-stone-900">
                    {item.item_name}
                    {item.size_name && (
                      <span className="text-stone-600 font-normal"> ({item.size_name})</span>
                    )}
                  </div>
                  <div className="w-1/6 text-center text-stone-700 font-mono">
                    {item.quantity}
                  </div>
                  <div className="w-1/3 text-right font-mono font-bold text-stone-900">
                    ₱{itemPrice.toFixed(2)}
                  </div>
                </div>

                {/* Customizations / Addons */}
                {item.addons && item.addons.length > 0 && (
                  <div className="text-[9px] text-stone-500 pl-2">
                    {item.addons.map((addon, aIdx) => (
                      <div key={addon.order_item_addon_id || aIdx} className="italic">
                        + {addon.addon_name || "Addon"} {addon.quantity > 1 ? `x${addon.quantity}` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Special Instructions */}
                {item.special_instructions && (
                  <div className="text-[9px] text-amber-800 italic pl-2">
                    Note: {item.special_instructions}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-[10px] text-stone-500 italic text-center py-1">
            Standard Order
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-stone-400 my-2" />

      {/* Financial Totals */}
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between text-stone-700">
          <span>Subtotal:</span>
          <span className="font-mono">₱{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-800">
            <span>Discount:</span>
            <span className="font-mono">-₱{discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-stone-700">
          <span>Tax (8%):</span>
          <span className="font-mono">₱{tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs font-black text-stone-900 border-t border-stone-300 pt-1">
          <span>TOTAL DUE:</span>
          <span className="font-mono text-sm">₱{total.toFixed(2)}</span>
        </div>

        {tendered !== null && (
          <div className="flex justify-between text-stone-700 pt-0.5">
            <span>Cash Tendered:</span>
            <span className="font-mono">₱{tendered.toFixed(2)}</span>
          </div>
        )}
        {change !== null && (
          <div className="flex justify-between font-bold text-stone-900 border-t border-dotted border-stone-300 pt-0.5">
            <span>Change Given:</span>
            <span className="font-mono font-black">₱{change.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-stone-400 my-2" />

      {/* Barcode Visual Representation */}
      <div className="text-center py-1">
        <div className="inline-block tracking-widest text-xs font-mono font-bold select-none text-stone-800">
          ||||| | |||| ||| || |||||| | ||| ||||
        </div>
        <div className="text-[8px] text-stone-500 font-mono mt-0.5">
          REF-{order.order_id}-{order.pickup_code || "POS"}
        </div>
      </div>

      {/* Thermal Footer */}
      <div className="text-center text-[9px] text-stone-500 font-sans space-y-0.5 pt-1">
        <p className="font-medium">Thank you for visiting {storeProfile.storeName || "ldrn's coffee"}!</p>
        <p>Please present pickup code at the counter.</p>
        <p className="text-[8px] text-stone-400 pt-1">This serves as your official customer receipt.</p>
      </div>
    </div>
  );
}
