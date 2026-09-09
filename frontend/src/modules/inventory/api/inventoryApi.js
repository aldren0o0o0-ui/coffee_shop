import apiClient from "../../../api/client";

export async function fetchInventoryOptions() {
  const response = await apiClient.get("/inventory/options");
  return response.data;
}

export async function fetchInventoryItems() {
  const response = await apiClient.get("/inventory/items");
  return response.data;
}
