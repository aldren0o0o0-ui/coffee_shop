import { useState, useEffect, useRef } from "react";
import {
  createProductDraft,
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImages,
  publishProduct,
} from "../api/menuApi";
import { getImageUrl } from "../utils/image";

export default function ProductWizardModal({
  isOpen,
  onClose,
  categories = [],
  inventoryOptions = [],
  onProductPublished,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState(null);
  const [draftSavedTime, setDraftSavedTime] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.category_id?.toString() || "");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});

  // Step 2: Photos
  const [images, setImages] = useState([]); // [{ id, url, isPrimary, displayOrder, isUploading, progress, error, file }]
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Step 3: Pricing & Sizes
  const [basePrice, setBasePrice] = useState("4.50");
  const [hasSizes, setHasSizes] = useState(true);
  const [sizes, setSizes] = useState([
    { size_name: "Regular", price_adjustment: "0.00", is_default: true },
    { size_name: "Large", price_adjustment: "1.00", is_default: false },
  ]);

  // Step 4: Customizations (Addons)
  const [addons, setAddons] = useState([
    { addon_name: "Extra Espresso Shot", additional_price: "0.80", is_active: true },
    { addon_name: "Oat Milk Substitute", additional_price: "0.75", is_active: true },
  ]);

  // Step 5: Recipe / Stock Link
  const [ingredients, setIngredients] = useState([]);

  // Step 6: Availability & Preview
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].category_id.toString());
    }
  }, [categories, categoryId]);

  if (!isOpen) return null;

  const totalSteps = 6;
  const stepTitles = [
    "Basic Info",
    "Photos",
    "Pricing & Sizes",
    "Customizations",
    "Recipe & Stock",
    "Preview & Publish",
  ];

  // Helper: auto-create draft when moving past step 1 if not created yet
  async function ensureDraftCreated() {
    if (draftId) return draftId;
    try {
      setIsSavingDraft(true);
      const res = await createProductDraft({
        category_id: parseInt(categoryId, 10),
        item_name: name.trim() || "Untitled Product Draft",
        description: description.trim() || null,
        base_price: parseFloat(basePrice) || 0.0,
      });
      setDraftId(res.menu_item_id);
      setDraftSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      return res.menu_item_id;
    } catch (err) {
      console.error("Failed to create product draft:", err);
      setGlobalError("Unable to initialize product draft on server.");
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  }

  // --- Step 1 Validation ---
  function validateStep1() {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = "Please give your item a name so customers can identify it.";
    } else if (name.trim().length < 2) {
      newErrors.name = "Item name should be at least 2 characters.";
    }
    if (!categoryId) {
      newErrors.category = "Please select a category for this item.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // --- Step 3 Validation ---
  function validateStep3() {
    const newErrors = {};
    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.basePrice = "Please enter a valid starting price ($0.00 or higher).";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // --- Navigation ---
  async function handleNext() {
    setGlobalError("");
    if (currentStep === 1) {
      if (!validateStep1()) return;
      const id = await ensureDraftCreated();
      if (!id) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!validateStep3()) return;
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    } else if (currentStep === 5) {
      setCurrentStep(6);
    }
  }

  function handleBack() {
    setGlobalError("");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  // --- Photo Upload Logic ---
  async function handleUploadFiles(files) {
    if (!files || files.length === 0) return;
    const currentCount = images.length;
    if (currentCount >= 5) {
      setGlobalError("You can add up to 5 photos per product. Remove an existing photo to add a new one.");
      return;
    }

    const availableSlots = 5 - currentCount;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    const activeDraftId = await ensureDraftCreated();
    if (!activeDraftId) return;

    for (const file of filesToUpload) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempPreviewUrl = URL.createObjectURL(file);

      // Add placeholder thumbnail in uploading state
      setImages((prev) => [
        ...prev,
        {
          id: tempId,
          url: tempPreviewUrl,
          isPrimary: prev.length === 0,
          displayOrder: prev.length,
          isUploading: true,
          progress: 0,
          error: null,
          file,
        },
      ]);

      // Upload independently
      try {
        const uploaded = await uploadProductImage(activeDraftId, file, (percent) => {
          setImages((prev) =>
            prev.map((img) => (img.id === tempId ? { ...img, progress: percent } : img))
          );
        });

        // Replace temp object with persisted backend image data
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
                  file: null,
                }
              : img
          )
        );
        setDraftSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (err) {
        console.error("Image upload failed:", err);
        const errMsg = err.response?.data?.detail || "Upload failed. Please check file format & size.";
        setImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? {
                  ...img,
                  isUploading: false,
                  progress: 0,
                  error: errMsg,
                }
              : img
          )
        );
      }
    }
  }

  async function handleRetryUpload(tempImage) {
    if (!tempImage.file || !draftId) return;
    setImages((prev) =>
      prev.map((img) =>
        img.id === tempImage.id ? { ...img, isUploading: true, error: null, progress: 10 } : img
      )
    );

    try {
      const uploaded = await uploadProductImage(draftId, tempImage.file, (percent) => {
        setImages((prev) =>
          prev.map((img) => (img.id === tempImage.id ? { ...img, progress: percent } : img))
        );
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImage.id
            ? {
                id: uploaded.menu_item_image_id,
                url: uploaded.image_url,
                isPrimary: uploaded.is_primary,
                displayOrder: uploaded.display_order,
                isUploading: false,
                progress: 100,
                error: null,
                file: null,
              }
            : img
        )
      );
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Upload failed again.";
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImage.id ? { ...img, isUploading: false, error: errMsg } : img
        )
      );
    }
  }

  async function handleDeleteImage(image) {
    if (image.isUploading) {
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      return;
    }
    if (typeof image.id === "string" && image.id.startsWith("temp-")) {
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      return;
    }

    try {
      const updatedProduct = await deleteProductImage(draftId, image.id);
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
    } catch (err) {
      console.error("Failed to delete image:", err);
      setGlobalError("Unable to remove image.");
    }
  }

  async function handleSetPrimary(imageId) {
    if (!draftId) return;
    try {
      const updated = await setPrimaryProductImage(draftId, imageId);
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
    } catch (err) {
      console.error("Failed to set primary image:", err);
    }
  }

  async function handleMoveImage(index, direction) {
    const newImages = [...images];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;

    const [moved] = newImages.splice(index, 1);
    newImages.splice(targetIndex, 0, moved);

    setImages(newImages);

    // Persist reorder if saved
    if (draftId && newImages.every((img) => typeof img.id === "number")) {
      try {
        await reorderProductImages(
          draftId,
          newImages.map((img) => img.id)
        );
      } catch (err) {
        console.error("Failed to reorder images on server:", err);
      }
    }
  }

  // --- Final Publish Action ---
  async function handlePublish() {
    if (!validateStep1() || !validateStep3()) {
      setGlobalError("Please resolve errors before publishing.");
      return;
    }
    const targetDraftId = draftId || (await ensureDraftCreated());
    if (!targetDraftId) return;

    setIsPublishing(true);
    setGlobalError("");

    try {
      const publishPayload = {
        category_id: parseInt(categoryId, 10),
        item_name: name.trim(),
        description: description.trim() || null,
        base_price: parseFloat(basePrice) || 0.0,
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
            is_active: a.is_active,
          })),
        ingredients: ingredients
          .filter((i) => i.inventory_item_id && parseFloat(i.quantity_required) > 0)
          .map((i) => ({
            inventory_item_id: parseInt(i.inventory_item_id, 10),
            quantity_required: i.quantity_required.toString(),
            unit_of_measure: i.unit_of_measure || "unit",
          })),
      };

      const published = await publishProduct(targetDraftId, publishPayload);
      if (onProductPublished) {
        onProductPublished(published);
      }
      onClose();
    } catch (err) {
      console.error("Publishing product failed:", err);
      setGlobalError(err.response?.data?.detail || "Unable to publish product. Please review all fields.");
    } finally {
      setIsPublishing(false);
    }
  }

  // Active Category Name for preview
  const activeCategory = categories.find((c) => c.category_id.toString() === categoryId);
  const primaryImage = images.find((img) => img.isPrimary && !img.isUploading && !img.error) || images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-2 backdrop-blur-xs sm:p-4">
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* TOP BAR: Title, Progress, Draft Badge, Close */}
        <div className="border-b border-stone-200 bg-stone-50/80 px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-900">
                  {currentStep}
                </span>
                <h2 className="text-base font-bold text-stone-900 sm:text-lg">
                  Add New Menu Item
                </h2>
                {draftSavedTime && (
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Draft saved {draftSavedTime}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Step {currentStep} of {totalSteps}: <strong className="text-stone-700">{stepTitles[currentStep - 1]}</strong>
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
              title="Close wizard"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar & Dots */}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {stepTitles.map((title, idx) => {
                const stepNum = idx + 1;
                const isComplete = currentStep > stepNum;
                const isCurrent = currentStep === stepNum;
                return (
                  <div key={title} className="flex flex-1 items-center gap-1">
                    <div
                      className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                        isComplete
                          ? "bg-amber-600"
                          : isCurrent
                          ? "bg-amber-800 ring-2 ring-amber-200"
                          : "bg-stone-200"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {globalError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              <span>⚠️</span>
              <span>{globalError}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: BASIC INFO */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">What are we brewing?</h3>
                <p className="text-xs text-stone-500">
                  Enter the basic customer-facing details for this new menu item.
                </p>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800">
                  What is this item called? <span className="text-amber-700">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                  }}
                  onBlur={validateStep1}
                  placeholder="e.g. Honey Cinnamon Oat Latte"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 ${
                    errors.name
                      ? "border-red-300 bg-red-50/50 focus:ring-red-200"
                      : "border-stone-300 bg-white focus:border-amber-700 focus:ring-amber-100"
                  }`}
                />
                {errors.name ? (
                  <p className="text-xs font-semibold text-red-600">{errors.name}</p>
                ) : (
                  <p className="text-[11px] text-stone-400">
                    This is the main title shown on customer menus, receipts, and barista tickets.
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800">
                  Which category does it belong to? <span className="text-amber-700">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium transition focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100"
                >
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-400">
                  Helps guests find this item quickly when filtering the digital menu.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800">
                  How would you describe it to a customer? <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Rich espresso combined with velvety steamed oat milk, local raw wildflower honey, and dusted with fragrant Ceylon cinnamon."
                  className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-medium transition focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
                <p className="text-[11px] text-stone-400">
                  Appears in the product details modal. Mention flavor notes, origin, or temperature.
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: PHOTOS (HIGH-FIDELITY SHOWCASE SCREEN) */}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add Mouth-Watering Photos</h3>
                <p className="text-xs text-stone-500">
                  Upload up to 5 high-quality photos. The image marked <strong>Primary</strong> is what customers see on the main menu.
                </p>
              </div>

              {/* Guidance Banner */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <span className="text-base">💡</span>
                <div>
                  <p className="font-bold">Tips for high-converting menu photos:</p>
                  <p className="text-amber-800">
                    Bright natural lighting, square or 4:3 landscape ratio, at least 800×800px. JPG, PNG, or WebP up to 5MB.
                  </p>
                </div>
              </div>

              {/* Drag & Drop Upload Zone */}
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
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  isDragging
                    ? "border-amber-600 bg-amber-50/80 ring-4 ring-amber-100"
                    : "border-stone-300 bg-stone-50/50 hover:bg-stone-50"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>

                <p className="mt-2 text-sm font-bold text-stone-900">
                  Drag & drop your photos here
                </p>
                <p className="text-xs text-stone-500">or tap below to choose from your device</p>

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
                  className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-800 disabled:opacity-50 transition"
                >
                  {images.length >= 5 ? "Max 5 photos reached" : "Browse Files"}
                </button>
              </div>

              {/* Uploaded Thumbnails Grid */}
              {images.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-stone-800">
                      Uploaded Photos ({images.length}/5)
                    </p>
                    <span className="text-[11px] text-stone-400">
                      Drag or use arrows to rearrange
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-xs transition ${
                          img.isPrimary ? "border-amber-600 ring-2 ring-amber-500/30" : "border-stone-200"
                        }`}
                      >
                        {/* Image Preview / Upload Status */}
                        <div className="relative aspect-square w-full bg-stone-100">
                          <img
                            src={getImageUrl(img.url)}
                            alt="Product photo thumbnail"
                            className="h-full w-full object-cover"
                          />

                          {/* Primary Badge */}
                          {img.isPrimary && (
                            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-md bg-amber-900/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                              ⭐ Primary
                            </span>
                          )}

                          {/* Uploading Progress Overlay */}
                          {img.isUploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/70 p-2 text-white">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              <span className="mt-1.5 text-[10px] font-bold">{img.progress}%</span>
                            </div>
                          )}

                          {/* Error State with Retry */}
                          {img.error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 p-2 text-center text-white">
                              <span className="text-xs font-bold text-red-200">Failed</span>
                              <button
                                type="button"
                                onClick={() => handleRetryUpload(img)}
                                className="mt-1 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-red-900 shadow-xs"
                              >
                                Retry
                              </button>
                            </div>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img)}
                            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition"
                            title="Remove photo"
                          >
                            ×
                          </button>
                        </div>

                        {/* Thumbnail Actions */}
                        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/80 p-1.5 text-[11px]">
                          {!img.isPrimary && !img.isUploading && !img.error && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(img.id)}
                              className="font-bold text-amber-800 hover:underline text-[10px]"
                            >
                              Make Primary
                            </button>
                          )}
                          {img.isPrimary && (
                            <span className="text-[10px] font-semibold text-stone-500">Main hero</span>
                          )}

                          {/* Reorder Arrows */}
                          <div className="flex items-center gap-0.5 ml-auto">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveImage(idx, -1)}
                              className="rounded p-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-20"
                              title="Move left"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              disabled={idx === images.length - 1}
                              onClick={() => handleMoveImage(idx, 1)}
                              className="rounded p-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-20"
                              title="Move right"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Empty state gentle warning */
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <p className="text-xs text-stone-600">
                    No photos added yet. If you proceed, this item will use a friendly coffee cup illustration on the menu until you upload photos later.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: PRICING & SIZES */}
          {/* ============================================================ */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Set Base Price & Sizes</h3>
                <p className="text-xs text-stone-500">
                  Define your regular serving price and optional size adjustments.
                </p>
              </div>

              {/* Base Price */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800">
                  What is the standard base price? <span className="text-amber-700">*</span>
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-stone-400">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    onBlur={validateStep3}
                    placeholder="4.50"
                    className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-8 pr-3.5 text-sm font-bold text-stone-900 transition focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                {errors.basePrice ? (
                  <p className="text-xs font-semibold text-red-600">{errors.basePrice}</p>
                ) : (
                  <p className="text-[11px] text-stone-400">
                    Starting price for a regular/standard serving before add-ons.
                  </p>
                )}
              </div>

              {/* Sizes Toggle */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-stone-800">Do you offer different sizes?</p>
                    <p className="text-[11px] text-stone-500">
                      e.g. Small (8oz), Regular (12oz), Large (16oz)
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={hasSizes}
                      onChange={(e) => setHasSizes(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-stone-300 peer-checked:bg-amber-800 peer-focus:ring-2 peer-focus:ring-amber-300 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                {hasSizes && (
                  <div className="mt-4 space-y-2 border-t border-stone-200 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700">Size Options & Adjustments</span>
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
                        + Add another size
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
                            placeholder="Size name (e.g. Grande)"
                            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-stone-400">+$</span>
                            <input
                              type="number"
                              step="0.05"
                              value={s.price_adjustment}
                              onChange={(e) => {
                                const copy = [...sizes];
                                copy[idx].price_adjustment = e.target.value;
                                setSizes(copy);
                              }}
                              placeholder="0.00"
                              className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-bold"
                            />
                          </div>

                          <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600">
                            <input
                              type="radio"
                              name="defaultSize"
                              checked={s.is_default}
                              onChange={() => {
                                setSizes(
                                  sizes.map((item, i) => ({ ...item, is_default: i === idx }))
                                );
                              }}
                            />
                            Default
                          </label>

                          {sizes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSizes(sizes.filter((_, i) => i !== idx))}
                              className="text-stone-400 hover:text-red-600 px-1 text-base"
                              title="Delete size"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 4: CUSTOMIZATIONS (ADD-ONS) */}
          {/* ============================================================ */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Customizations & Add-ons</h3>
                  <p className="text-xs text-stone-500">
                    Allow customers to customize their order with extra shots, alternative milks, or syrups.
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                  Optional
                </span>
              </div>

              <div className="space-y-2">
                {addons.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/50 p-2.5"
                  >
                    <input
                      type="text"
                      value={a.addon_name}
                      onChange={(e) => {
                        const copy = [...addons];
                        copy[idx].addon_name = e.target.value;
                        setAddons(copy);
                      }}
                      placeholder="Add-on name (e.g. Vanilla Syrup)"
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium"
                    />

                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-stone-400">+$</span>
                      <input
                        type="number"
                        step="0.05"
                        value={a.additional_price}
                        onChange={(e) => {
                          const copy = [...addons];
                          copy[idx].additional_price = e.target.value;
                          setAddons(copy);
                        }}
                        className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddons(addons.filter((_, i) => i !== idx))}
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setAddons((prev) => [
                      ...prev,
                      { addon_name: "", additional_price: "0.50", is_active: true },
                    ])
                  }
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline"
                >
                  + Add Customization Option
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 5: RECIPE / STOCK LINK */}
          {/* ============================================================ */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Link Inventory Ingredients</h3>
                  <p className="text-xs text-stone-500">
                    Connect this recipe to inventory items to enable automatic stock deduction.
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                  Optional
                </span>
              </div>

              {/* Informational Banner */}
              <div className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
                <span className="text-base">📦</span>
                <div>
                  <p className="font-bold">How automated recipe tracking works:</p>
                  <p className="text-stone-500">
                    Each time a cashier or customer orders this item, BrewFlow automatically subtracts the exact ingredient quantities from your live stock.
                  </p>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="space-y-2">
                {ingredients.map((ing, idx) => {
                  const selectedInv = inventoryOptions.find(
                    (i) => i.inventory_item_id.toString() === ing.inventory_item_id?.toString()
                  );
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 shadow-xs"
                    >
                      <select
                        value={ing.inventory_item_id || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const inv = inventoryOptions.find(
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
                        className="min-w-[180px] flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="">Select ingredient...</option>
                        {inventoryOptions.map((inv) => (
                          <option key={inv.inventory_item_id} value={inv.inventory_item_id}>
                            {inv.item_name} ({inv.quantity_on_hand} {inv.unit_of_measure} in stock)
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
                          placeholder="Amount"
                          className="w-24 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-bold text-right"
                        />
                        <span className="text-xs font-bold text-stone-500 min-w-[32px]">
                          {selectedInv ? selectedInv.unit_of_measure : "units"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-stone-400 hover:text-red-600"
                        title="Remove ingredient"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setIngredients((prev) => [
                      ...prev,
                      { inventory_item_id: "", quantity_required: "0.020", unit_of_measure: "kg" },
                    ])
                  }
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline"
                >
                  + Link an ingredient
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 6: AVAILABILITY & REAL LIVE PREVIEW */}
          {/* ============================================================ */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Live Customer Menu Preview</h3>
                <p className="text-xs text-stone-500">
                  Review exactly how your new item will look to online customers and in-store staff before publishing.
                </p>
              </div>

              {/* Availability Switch */}
              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                <div>
                  <p className="text-xs font-bold text-stone-900">Immediate Availability</p>
                  <p className="text-[11px] text-stone-500">
                    {isAvailable
                      ? "Item will be active and ready to order on customer menus immediately upon publishing."
                      : "Item will be created as 86'd (Hidden/Unavailable) until you turn it on."}
                  </p>
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

              {/* LIVE PREVIEW COMPONENT */}
              <div className="rounded-2xl border border-amber-900/10 bg-amber-50/40 p-4 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    👁️ Real Customer Storefront View
                  </span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    {activeCategory?.category_name || "Coffee"}
                  </span>
                </div>

                {/* Card Replica */}
                <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md">
                  <div className="relative aspect-video w-full bg-stone-100">
                    {primaryImage ? (
                      <img
                        src={getImageUrl(primaryImage.url)}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-amber-900/5 text-amber-900">
                        <span className="text-3xl">☕</span>
                        <span className="mt-1 text-[11px] font-semibold text-stone-400">
                          Default Coffee Icon
                        </span>
                      </div>
                    )}
                    {images.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        📷 {images.length} photos
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-bold text-stone-900">
                        {name || "Untitled Item"}
                      </h4>
                      <span className="text-base font-extrabold text-amber-900">
                        ${parseFloat(basePrice || 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-xs text-stone-500">
                      {description || "No description provided."}
                    </p>

                    {/* Sizes Pills */}
                    {hasSizes && sizes.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Sizes
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {sizes.map((s, idx) => (
                            <span
                              key={idx}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                s.is_default
                                  ? "bg-amber-900 text-white"
                                  : "bg-stone-100 text-stone-700"
                              }`}
                            >
                              {s.size_name || `Size ${idx + 1}`}{" "}
                              {parseFloat(s.price_adjustment) > 0 &&
                                `(+$${parseFloat(s.price_adjustment).toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add-ons List */}
                    {addons.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Available Add-ons
                        </p>
                        <p className="text-[11px] text-stone-600">
                          {addons.map((a) => a.addon_name).filter(Boolean).join(", ") || "None"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR (STICKY) */}
        <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800 transition"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-2">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSavingDraft}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-800 disabled:opacity-50 transition"
                >
                  {isSavingDraft ? "Saving..." : "Next Step →"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-600 disabled:opacity-50 transition"
                >
                  {isPublishing ? "Publishing to Menu..." : "🚀 Publish Product"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
