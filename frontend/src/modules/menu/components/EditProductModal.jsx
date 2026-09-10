import { useState, useEffect, useRef } from "react";
import {
  updateProduct,
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImages,
} from "../api/menuApi";
import { createInventoryItem } from "../../inventory/api/inventoryApi";
import { getImageUrl } from "../utils/image";

export default function EditProductModal({
  isOpen,
  onClose,
  product,
  categories = [],
  inventoryOptions = [],
  onProductUpdated,
  onInventoryItemCreated,
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("100.00");
  const [isAvailable, setIsAvailable] = useState(true);

  // Photos
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Sizes
  const [hasSizes, setHasSizes] = useState(true);
  const [sizes, setSizes] = useState([]);

  // Addons
  const [addons, setAddons] = useState([]);

  // Recipe Ingredients
  const [ingredients, setIngredients] = useState([]);
  const [localInventoryOptions, setLocalInventoryOptions] = useState(inventoryOptions);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    item_name: "",
    unit_of_measure: "kg",
    quantity_on_hand: "10",
    reorder_level: "2",
    unit_cost: "0",
  });
  const [isSubmittingQuickAdd, setIsSubmittingQuickAdd] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");
  const [quickAddSuccess, setQuickAddSuccess] = useState("");

  useEffect(() => {
    setLocalInventoryOptions(inventoryOptions);
  }, [inventoryOptions]);

  async function handleQuickAddIngredient(e) {
    e.preventDefault();
    if (!quickAddForm.item_name.trim()) {
      setQuickAddError("Please enter an ingredient name.");
      return;
    }
    setIsSubmittingQuickAdd(true);
    setQuickAddError("");
    try {
      const newItem = await createInventoryItem({
        item_name: quickAddForm.item_name.trim(),
        unit_of_measure: quickAddForm.unit_of_measure.trim() || "unit",
        quantity_on_hand: parseFloat(quickAddForm.quantity_on_hand) || 0,
        reorder_level: parseFloat(quickAddForm.reorder_level) || 0,
        unit_cost: parseFloat(quickAddForm.unit_cost) || 0,
        is_active: true,
      });

      const formattedItem = {
        inventory_item_id: newItem.inventory_item_id,
        item_name: newItem.item_name,
        unit_of_measure: newItem.unit_of_measure,
        quantity_on_hand: newItem.quantity_on_hand,
      };

      setLocalInventoryOptions((prev) => [...prev, formattedItem]);

      const defaultQty =
        newItem.unit_of_measure === "g"
          ? "18"
          : newItem.unit_of_measure === "ml"
          ? "200"
          : "0.020";

      setIngredients((prev) => [
        ...prev,
        {
          inventory_item_id: String(newItem.inventory_item_id),
          quantity_required: defaultQty,
          unit_of_measure: newItem.unit_of_measure,
        },
      ]);

      if (onInventoryItemCreated) {
        onInventoryItemCreated(formattedItem);
      }

      setQuickAddSuccess(`Added "${newItem.item_name}" to inventory & linked to recipe!`);
      setTimeout(() => {
        setQuickAddSuccess("");
        setIsQuickAddOpen(false);
        setQuickAddForm({
          item_name: "",
          unit_of_measure: "kg",
          quantity_on_hand: "10",
          reorder_level: "2",
          unit_cost: "0",
        });
      }, 1000);
    } catch (err) {
      console.error("Quick add ingredient failed:", err);
      setQuickAddError(err.response?.data?.detail || "Failed to create ingredient.");
    } finally {
      setIsSubmittingQuickAdd(false);
    }
  }

  // Form states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("general"); // "general" | "photos" | "sizes" | "recipe"

  useEffect(() => {
    if (product && isOpen) {
      setName(product.item_name || "");
      setCategoryId(product.category_id?.toString() || (categories[0]?.category_id?.toString() || ""));
      setDescription(product.description || "");
      setBasePrice(product.base_price?.toString() || "4.50");
      setIsAvailable(product.is_available ?? true);

      // Photos
      const loadedImages = product.images && product.images.length > 0
        ? product.images.map((img) => ({
            id: img.menu_item_image_id,
            url: img.image_url,
            isPrimary: img.is_primary,
            displayOrder: img.display_order,
            isUploading: false,
            progress: 100,
            error: null,
          }))
        : (product.image_url ? [{ id: "legacy-1", url: product.image_url, isPrimary: true, isUploading: false, progress: 100 }] : []);
      setImages(loadedImages);

      // Sizes
      if (product.sizes && product.sizes.length > 0) {
        setHasSizes(true);
        setSizes(
          product.sizes.map((s) => ({
            size_name: s.size_name,
            price_adjustment: s.price_adjustment?.toString() || "0.00",
            is_default: s.is_default,
          }))
        );
      } else {
        setHasSizes(false);
        setSizes([{ size_name: "Regular", price_adjustment: "0.00", is_default: true }]);
      }

      // Addons
      if (product.addons && product.addons.length > 0) {
        setAddons(
          product.addons.map((a) => ({
            addon_name: a.addon_name,
            additional_price: a.additional_price?.toString() || "0.00",
            is_active: a.is_active,
          }))
        );
      } else {
        setAddons([]);
      }

      // Ingredients
      if (product.ingredients && product.ingredients.length > 0) {
        // Map ingredient strings or objects back to inventory options if possible
        const mapped = product.ingredients.map((ingName) => {
          const invMatch = inventoryOptions.find((i) => i.item_name.toLowerCase() === ingName.toLowerCase());
          return {
            inventory_item_id: invMatch ? invMatch.inventory_item_id.toString() : "",
            quantity_required: "0.020",
            unit_of_measure: invMatch ? invMatch.unit_of_measure : "kg",
          };
        });
        setIngredients(mapped);
      } else {
        setIngredients([]);
      }

      setErrorMessage("");
      setActiveTab("general");
    }
  }, [product, isOpen, categories, inventoryOptions]);

  if (!isOpen || !product) return null;

  // Photo handlers
  async function handleUploadFiles(files) {
    if (!files || files.length === 0) return;
    if (images.length >= 5) {
      setErrorMessage("Maximum limit of 5 photos per product reached.");
      return;
    }

    const availableSlots = 5 - images.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    for (const file of filesToUpload) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempUrl = URL.createObjectURL(file);

      setImages((prev) => [
        ...prev,
        {
          id: tempId,
          url: tempUrl,
          isPrimary: prev.length === 0,
          displayOrder: prev.length,
          isUploading: true,
          progress: 0,
          error: null,
          file,
        },
      ]);

      try {
        const uploaded = await uploadProductImage(product.menu_item_id, file, (percent) => {
          setImages((prev) =>
            prev.map((img) => (img.id === tempId ? { ...img, progress: percent } : img))
          );
        });

        setImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? {
                  id: uploaded.menu_item_image_id,
                  url: uploaded.image_url,
                  isPrimary: uploaded.is_primary,
                  displayOrder: uploaded.display_order,
                  isUploading: false,
                  progress: 100,
                  error: null,
                }
              : img
          )
        );
      } catch (err) {
        const errMsg = err.response?.data?.detail || "Upload failed.";
        setImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...img, isUploading: false, error: errMsg }
              : img
          )
        );
      }
    }
  }

  async function handleDeleteImage(image) {
    if (typeof image.id === "string" && image.id.startsWith("temp-")) {
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      return;
    }

    try {
      const updatedProduct = await deleteProductImage(product.menu_item_id, image.id);
      setImages(
        updatedProduct.images.map((img) => ({
          id: img.menu_item_image_id,
          url: img.image_url,
          isPrimary: img.is_primary,
          displayOrder: img.display_order,
          isUploading: false,
          progress: 100,
          error: null,
        }))
      );
    } catch {
      setErrorMessage("Unable to remove image.");
    }
  }

  async function handleSetPrimary(imageId) {
    try {
      const updated = await setPrimaryProductImage(product.menu_item_id, imageId);
      setImages(
        updated.images.map((img) => ({
          id: img.menu_item_image_id,
          url: img.image_url,
          isPrimary: img.is_primary,
          displayOrder: img.display_order,
          isUploading: false,
          progress: 100,
          error: null,
        }))
      );
    } catch {
      setErrorMessage("Unable to set primary photo.");
    }
  }

  async function handleMoveImage(index, direction) {
    const newImages = [...images];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;

    const [moved] = newImages.splice(index, 1);
    newImages.splice(targetIndex, 0, moved);
    setImages(newImages);

    if (newImages.every((img) => typeof img.id === "number")) {
      try {
        await reorderProductImages(product.menu_item_id, newImages.map((img) => img.id));
      } catch (err) {
        console.error("Failed to reorder images:", err);
      }
    }
  }

  // Save changes
  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Product name cannot be empty.");
      return;
    }
    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage("Please enter a valid base price.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const payload = {
        category_id: parseInt(categoryId, 10),
        item_name: name.trim(),
        description: description.trim() || null,
        base_price: priceNum,
        is_available: isAvailable,
        sizes: hasSizes
          ? sizes
              .filter((s) => s.size_name.trim())
              .map((s) => ({
                size_name: s.size_name.trim(),
                price_adjustment: s.price_adjustment || "0.00",
                is_default: s.is_default,
              }))
          : [
              {
                size_name: "Regular",
                price_adjustment: "0.00",
                is_default: true,
              },
            ],
        addons: addons
          .filter((a) => a.addon_name.trim())
          .map((a) => ({
            addon_name: a.addon_name.trim(),
            additional_price: a.additional_price || "0.00",
            is_active: a.is_active ?? true,
          })),
        ingredients: ingredients
          .filter((i) => i.inventory_item_id && parseFloat(i.quantity_required) > 0)
          .map((i) => ({
            inventory_item_id: parseInt(i.inventory_item_id, 10),
            quantity_required: i.quantity_required.toString(),
            unit_of_measure: i.unit_of_measure || "unit",
          })),
      };

      const updated = await updateProduct(product.menu_item_id, payload);
      if (onProductUpdated) {
        onProductUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error("Update failed:", err);
      setErrorMessage(err.response?.data?.detail || "Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-3 backdrop-blur-xs sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 sm:text-xl">
              Edit Product: <span className="text-amber-900">{product.item_name}</span>
            </h2>
            <p className="text-xs text-stone-500">
              Update pricing, photos, sizes, customizations, and linked recipes.
            </p>
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

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "general"
                ? "border-amber-900 text-amber-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            1. Details & Pricing
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("photos")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "photos"
                ? "border-amber-900 text-amber-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            2. Photos ({images.length}/5)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sizes")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "sizes"
                ? "border-amber-900 text-amber-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            3. Sizes & Add-ons
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("recipe")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "recipe"
                ? "border-amber-900 text-amber-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            4. Recipe & Stock
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: DETAILS & PRICING */}
          {activeTab === "general" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-800">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm font-semibold text-stone-900 focus:border-amber-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-800">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm font-semibold text-stone-900 focus:border-amber-700 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-800">
                    Starting Base Price (₱) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-stone-400">₱</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      required
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-8 pr-3.5 text-sm font-bold text-stone-900 focus:border-amber-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Immediate Stock Availability</span>
                    <span className="text-[11px] text-stone-500">
                      {isAvailable ? "Active (Can be ordered)" : "86'd (Hidden from customer menus)"}
                    </span>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-stone-300 peer-checked:bg-emerald-600 peer-focus:ring-2 peer-focus:ring-emerald-300 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800">
                  Tasting Notes & Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white p-3 text-xs font-medium focus:border-amber-700 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PHOTOS */}
          {activeTab === "photos" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleUploadFiles(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                  isDragging ? "border-amber-600 bg-amber-50" : "border-stone-300 bg-stone-50/60 hover:bg-stone-50"
                }`}
              >
                <p className="text-xs font-bold text-stone-900">Drag & drop new photos to add</p>
                <p className="text-[11px] text-stone-400">JPG, PNG, WebP up to 5MB</p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleUploadFiles(e.target.files)}
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 5}
                  className="mt-2.5 rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-800 disabled:opacity-50"
                >
                  {images.length >= 5 ? "Limit 5 reached" : "Browse Photos"}
                </button>
              </div>

              {/* Photo Thumbnails */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {images.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-xs ${
                        img.isPrimary ? "border-amber-600 ring-2 ring-amber-500/30" : "border-stone-200"
                      }`}
                    >
                      <div className="relative aspect-square w-full bg-stone-100">
                        <img
                          src={getImageUrl(img.url)}
                          alt="Thumbnail"
                          className="h-full w-full object-cover"
                        />
                        {img.isPrimary && (
                          <span className="absolute top-1.5 left-1.5 rounded-md bg-amber-900/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                            ⭐ Primary
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img)}
                          className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 p-1.5 text-[10px]">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(img.id)}
                            className="font-bold text-amber-800 hover:underline"
                          >
                            Make Primary
                          </button>
                        )}
                        {img.isPrimary && <span className="font-semibold text-stone-500">Hero</span>}

                        <div className="flex items-center gap-0.5 ml-auto">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveImage(idx, -1)}
                            className="rounded p-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-20"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            disabled={idx === images.length - 1}
                            onClick={() => handleMoveImage(idx, 1)}
                            className="rounded p-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-20"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIZES & ADD-ONS */}
          {activeTab === "sizes" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Sizes section */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                    Size Variants
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSizes((prev) => [
                        ...prev,
                        { size_name: "", price_adjustment: "0.50", is_default: false },
                      ])
                    }
                    className="text-xs font-bold text-amber-800 hover:underline"
                  >
                    + Add Size Option
                  </button>
                </div>

                <div className="space-y-2">
                  {sizes.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={s.size_name}
                        onChange={(e) => {
                          const copy = [...sizes];
                          copy[idx].size_name = e.target.value;
                          setSizes(copy);
                        }}
                        placeholder="Size name (e.g. Large)"
                        className="flex-1 rounded-xl border border-stone-300 bg-white p-2 text-xs font-medium"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-stone-400">+₱</span>
                        <input
                          type="number"
                          step="0.05"
                          value={s.price_adjustment}
                          onChange={(e) => {
                            const copy = [...sizes];
                            copy[idx].price_adjustment = e.target.value;
                            setSizes(copy);
                          }}
                          className="w-20 rounded-xl border border-stone-300 bg-white p-2 text-xs font-bold"
                        />
                      </div>
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600">
                        <input
                          type="radio"
                          name="editDefaultSize"
                          checked={s.is_default}
                          onChange={() => {
                            setSizes(sizes.map((item, i) => ({ ...item, is_default: i === idx })));
                          }}
                        />
                        Default
                      </label>
                      {sizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSizes(sizes.filter((_, i) => i !== idx))}
                          className="p-1 text-stone-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Addons section */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                    Custom Add-ons
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAddons((prev) => [
                        ...prev,
                        { addon_name: "", additional_price: "0.50", is_active: true },
                      ])
                    }
                    className="text-xs font-bold text-amber-800 hover:underline"
                  >
                    + Add Customization
                  </button>
                </div>

                <div className="space-y-2">
                  {addons.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a.addon_name}
                        onChange={(e) => {
                          const copy = [...addons];
                          copy[idx].addon_name = e.target.value;
                          setAddons(copy);
                        }}
                        placeholder="Addon (e.g. Extra Shot)"
                        className="flex-1 rounded-xl border border-stone-300 bg-white p-2 text-xs font-medium"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-stone-400">+₱</span>
                        <input
                          type="number"
                          step="0.05"
                          value={a.additional_price}
                          onChange={(e) => {
                            const copy = [...addons];
                            copy[idx].additional_price = e.target.value;
                            setAddons(copy);
                          }}
                          className="w-20 rounded-xl border border-stone-300 bg-white p-2 text-xs font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddons(addons.filter((_, i) => i !== idx))}
                        className="p-1 text-stone-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECIPE & STOCK */}
          {activeTab === "recipe" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Recipe Inventory Linking
                    </span>
                    <p className="text-[11px] text-stone-500">Auto-deducts raw stock upon POS and online checkout.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQuickAddOpen(true)}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition"
                    >
                      + Quick-Add Ingredient
                    </button>
                    {localInventoryOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setIngredients((prev) => [
                            ...prev,
                            { inventory_item_id: "", quantity_required: "0.020", unit_of_measure: "kg" },
                          ])
                        }
                        className="text-xs font-bold text-amber-800 hover:underline"
                      >
                        + Link Ingredient
                      </button>
                    )}
                  </div>
                </div>

                {localInventoryOptions.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-amber-300 bg-white p-5 text-center">
                    <span className="text-2xl">☕</span>
                    <p className="mt-1 text-xs font-bold text-amber-950">No Stock Ingredients Found</p>
                    <p className="mt-0.5 text-[11px] text-stone-500 max-w-sm mx-auto">
                      Add raw ingredients to enable automated stock deduction for this drink.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900 transition"
                      >
                        + Quick-Add Ingredient
                      </button>
                      <a
                        href="/inventory"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        Open Stock & Ingredients ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => {
                      const selectedInv = localInventoryOptions.find(
                        (i) => i.inventory_item_id.toString() === ing.inventory_item_id?.toString()
                      );
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={ing.inventory_item_id || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const inv = localInventoryOptions.find(
                                (i) => i.inventory_item_id.toString() === val
                              );
                              const copy = [...ingredients];
                              copy[idx] = {
                                ...copy[idx],
                                inventory_item_id: val,
                                unit_of_measure: inv ? inv.unit_of_measure : "unit",
                              };
                              setIngredients(copy);
                            }}
                            className="flex-1 rounded-xl border border-stone-300 bg-white p-2 text-xs font-semibold"
                          >
                            <option value="">Select ingredient...</option>
                            {localInventoryOptions.map((inv) => (
                              <option key={inv.inventory_item_id} value={inv.inventory_item_id}>
                                {inv.item_name} ({inv.quantity_on_hand} {inv.unit_of_measure} available)
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={ing.quantity_required}
                              onChange={(e) => {
                                const copy = [...ingredients];
                                copy[idx].quantity_required = e.target.value;
                                setIngredients(copy);
                              }}
                              className="w-20 rounded-xl border border-stone-300 bg-white p-2 text-xs font-bold"
                            />
                            <span className="text-xs font-bold text-stone-500 min-w-[28px]">
                              {selectedInv ? selectedInv.unit_of_measure : "unit"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                            className="p-1 text-stone-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTTOM CONTROLS */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-amber-900 px-6 py-2 text-xs font-extrabold text-white shadow-md hover:bg-amber-800 disabled:opacity-50"
            >
              {isSaving ? "Saving Changes..." : "Save Product Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* QUICK-ADD INGREDIENT MODAL */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Quick-Add Inventory Ingredient
                </h3>
                <p className="text-xs text-stone-500">
                  Creates stock item & auto-links to this recipe.
                </p>
              </div>
              <button
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => {
                  setIsQuickAddOpen(false);
                  setQuickAddError("");
                  setQuickAddSuccess("");
                }}
                type="button"
              >
                ✕
              </button>
            </div>

            {quickAddSuccess && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                {quickAddSuccess}
              </div>
            )}
            {quickAddError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {quickAddError}
              </div>
            )}

            <form className="mt-3.5 space-y-3" onSubmit={handleQuickAddIngredient}>
              <div>
                <label className="block text-xs font-bold text-stone-700">
                  Ingredient Name
                </label>
                <input
                  type="text"
                  required
                  value={quickAddForm.item_name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, item_name: e.target.value })}
                  placeholder="e.g. Espresso Beans, Whole Milk, Oat Milk, Vanilla Syrup"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700">
                    Unit of Measure
                  </label>
                  <input
                    list="edit-quick-unit-options"
                    type="text"
                    required
                    value={quickAddForm.unit_of_measure}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, unit_of_measure: e.target.value })}
                    placeholder="kg, g, L, ml, oz"
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                  <datalist id="edit-quick-unit-options">
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

                <div>
                  <label className="block text-xs font-bold text-stone-700">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quickAddForm.quantity_on_hand}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, quantity_on_hand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickAddForm.unit_cost}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, unit_cost: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quickAddForm.reorder_level}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, reorder_level: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAdd || !quickAddForm.item_name.trim()}
                  className="rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900 disabled:opacity-50 transition"
                >
                  {isSubmittingQuickAdd ? "Saving..." : "Save & Link to Recipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
