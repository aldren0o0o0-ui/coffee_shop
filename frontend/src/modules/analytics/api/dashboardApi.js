import apiClient from "../../../api/client";

export async function fetchDashboardOverview(branchId = null, role = null) {
  const params = {};
  if (branchId && branchId !== "all") params.branch_id = Number(branchId);
  if (role) params.role = role;
  const response = await apiClient.get("/dashboard/overview", { params });
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

export async function fetchStoreReports(period = "today") {
  const response = await apiClient.get("/dashboard/reports", {
    params: { period },
  });
  return response.data;
}
