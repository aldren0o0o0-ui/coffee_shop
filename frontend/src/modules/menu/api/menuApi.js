import apiClient from "../../../api/client";

export async function fetchMenuCatalog() {
  const response = await apiClient.get("/menu/catalog");
  return response.data;
}

export async function fetchTrashCatalog() {
  const response = await apiClient.get("/menu/trash");
  return response.data;
}

export async function createProductDraft(draftData) {
  const response = await apiClient.post("/menu/items/draft", draftData);
  return response.data;
}

export async function uploadProductImage(productId, file, onUploadProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post(`/menu/items/${productId}/images`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent);
      }
    },
  });
  return response.data;
}

export async function deleteProductImage(productId, imageId) {
  const response = await apiClient.delete(`/menu/items/${productId}/images/${imageId}`);
  return response.data;
}

export async function setPrimaryProductImage(productId, imageId) {
  const response = await apiClient.patch(`/menu/items/${productId}/images/${imageId}/primary`);
  return response.data;
}

export async function reorderProductImages(productId, imageIds) {
  const response = await apiClient.patch(`/menu/items/${productId}/images/reorder`, {
    image_ids: imageIds,
  });
  return response.data;
}

export async function publishProduct(productId, productData) {
  const response = await apiClient.put(`/menu/items/${productId}/publish`, productData);
  return response.data;
}

export async function updateProduct(productId, productData) {
  const response = await apiClient.put(`/menu/items/${productId}`, productData);
  return response.data;
}

export async function toggleProductTrash(productId, isDeleted) {
  const response = await apiClient.patch(`/menu/items/${productId}/trash`, {
    is_deleted: isDeleted,
  });
  return response.data;
}

export async function deleteProductPermanently(productId) {
  const response = await apiClient.delete(`/menu/items/${productId}/permanent`);
  return response.data;
}

export async function emptyTrashCatalog() {
  const response = await apiClient.delete("/menu/trash/empty");
  return response.data;
}

export async function addNewCategory(categoryData) {
  const response = await apiClient.post("/menu/categories", categoryData);
  return response.data;
}

export async function toggleProductAvailability(itemId, isAvailable) {
  const response = await apiClient.patch(`/menu/items/${itemId}/availability`, {
    is_available: isAvailable,
  });
  return response.data;
}

export async function fetchInventoryOptions() {
  const response = await apiClient.get("/menu/inventory-options");
  return response.data;
}
