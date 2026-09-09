import apiClient from "../../../api/client";

export async function fetchDashboardOverview() {
  const response = await apiClient.get("/dashboard/overview");
  return response.data;
}

export async function fetchBaristaQueue() {
  const response = await apiClient.get("/dashboard/barista-queue");
  return response.data;
}

export async function fetchInventoryDashboard() {
  const response = await apiClient.get("/dashboard/inventory");
  return response.data;
}
