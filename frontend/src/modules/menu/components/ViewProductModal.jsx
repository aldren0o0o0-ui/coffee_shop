import { useState, useEffect } from "react";
import { getImageUrl } from "../utils/image";

export default function ViewProductModal({
  isOpen,
  onClose,
  product,
  onEditClick,
  onRestoreClick,
  canManageProducts = false,
}) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [product]);

  if (!isOpen || !product) return null;

  const images = product.images && product.images.length > 0 ? product.images : (product.image_url ? [{ image_url: product.image_url, is_primary: true }] : []);
  const activePhoto = images[selectedPhotoIndex] || images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-3 backdrop-blur-xs sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 uppercase tracking-wider">
              {product.category_name || "Drink"}
            </span>

            {product.is_deleted ? (
              <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700">
                🗑️ In Trash Bin
              </span>
            ) : product.is_available ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                ● In Stock
              </span>
            ) : (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                ● 86&apos;d Out of Stock
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
            title="Close dialog"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* PHOTO GALLERY SECTION */}
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 border border-stone-200 shadow-inner">
              {activePhoto ? (
                <img
                  src={getImageUrl(activePhoto.image_url)}
                  alt={product.item_name}
                  className="h-full w-full object-cover transition duration-300"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-stone-400 bg-amber-900/5">
                  <span className="text-5xl">☕</span>
                  <span className="mt-2 text-xs font-semibold text-stone-400">Default Coffee Graphic</span>
                </div>
              )}

              {activePhoto?.is_primary && (
                <span className="absolute top-3 left-3 rounded-md bg-amber-900/90 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs backdrop-blur-xs">
                  ⭐ Primary Hero
                </span>
              )}
            </div>

            {/* Thumbnails Row if >1 image */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => {
                  const isSelected = idx === selectedPhotoIndex;
                  return (
                    <button
                      key={img.menu_item_image_id || idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      type="button"
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        isSelected ? "border-amber-900 ring-2 ring-amber-300" : "border-stone-200 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={getImageUrl(img.image_url)}
                        alt={`Thumb ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ITEM TITLE & PRICE */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {product.item_name}
              </h2>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed sm:text-sm">
                {product.description || "No description provided."}
              </p>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
                Starting Price
              </span>
              <span className="text-2xl font-extrabold text-amber-950">
                ₱{Number(product.base_price).toFixed(2)}
              </span>
            </div>
          </div>

          {/* SIZES BREAKDOWN */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Size Offerings & Variations
            </h4>
            {product.sizes && product.sizes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {product.sizes.map((size) => (
                  <div
                    key={size.menu_item_size_id}
                    className={`rounded-2xl border p-3 text-xs transition ${
                      size.is_default
                        ? "border-amber-800/40 bg-amber-50/60 text-amber-950"
                        : "border-stone-200 bg-stone-50 text-stone-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{size.size_name}</span>
                      {size.is_default && (
                        <span className="rounded bg-amber-900 text-[10px] text-white px-1 py-0.2">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {Number(size.price_adjustment) > 0
                        ? `+₱${Number(size.price_adjustment).toFixed(2)}`
                        : "Base price"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">Regular serving (single size)</p>
            )}
          </div>

          {/* CUSTOMIZATIONS & ADDONS */}
          {product.addons && product.addons.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Customizations & Add-ons
              </h4>
              <div className="flex flex-wrap gap-2">
                {product.addons.map((a) => (
                  <span
                    key={a.menu_item_addon_id}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-xs"
                  >
                    {a.addon_name}{" "}
                    <strong className="text-amber-900">
                      (+₱{Number(a.additional_price).toFixed(2)})
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* RECIPE INGREDIENTS */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📦</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Recipe & Automated Inventory Tracking
                </h4>
              </div>
              <p className="text-xs text-stone-500">
                The following ingredients are automatically deducted from stock when an order is submitted:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {product.ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-white border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-800"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {product.is_deleted && canManageProducts && onRestoreClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRestoreClick(product);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
              >
                <span>♻️</span>
                <span>Restore to Menu</span>
              </button>
            )}

            {!product.is_deleted && canManageProducts && onEditClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditClick(product);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-800 transition"
              >
                <span>✏️</span>
                <span>Edit Product</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
