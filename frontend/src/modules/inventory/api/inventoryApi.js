import apiClient from "../../../api/client";

export async function fetchInventoryOptions() {
  const response = await apiClient.get("/inventory/options");
  return response.data;
}

export async function fetchInventoryItems() {
  const response = await apiClient.get("/inventory/items");
  return response.data;
}

export async function createInventoryItem(itemData) {
  const response = await apiClient.post("/inventory/items", itemData);
  return response.data;
}

export async function updateInventoryItem(itemId, itemData) {
  const response = await apiClient.patch(`/inventory/items/${itemId}`, itemData);
  return response.data;
}

export async function adjustInventoryStock(itemId, adjustmentData) {
  const response = await apiClient.post(`/inventory/items/${itemId}/adjust`, adjustmentData);
  return response.data;
}

export async function fetchInventoryTransactions(limit = 50, itemId = null) {
  const params = { limit };
  if (itemId) params.item_id = itemId;
  const response = await apiClient.get("/inventory/transactions", { params });
  return response.data;
}

export async function fetchInventoryForecast(days = 7) {
  const response = await apiClient.get("/inventory/forecast", { params: { days } });
  return response.data;
}

export async function createForecastPurchaseRequest(days = 7) {
  const response = await apiClient.post("/inventory/forecast/purchase-request", { days });
  return response.data;
}
