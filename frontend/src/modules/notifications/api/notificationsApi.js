import apiClient from "../../../api/client";

export async function fetchAlerts(branchId = null, isResolved = false) {
  const params = {};
  if (branchId) params.branch_id = branchId;
  if (isResolved !== null) params.is_resolved = isResolved;
  const response = await apiClient.get("/notifications/alerts", { params });
  return response.data;
}

export async function resolveAlert(alertId) {
  const response = await apiClient.post(`/notifications/alerts/${alertId}/resolve`);
  return response.data;
}

export async function fetchAlertPreferences() {
  const response = await apiClient.get("/notifications/preferences");
  return response.data;
}

export async function updateAlertPreferences(data) {
  const response = await apiClient.put("/notifications/preferences", data);
  return response.data;
}

export async function triggerAlertEvaluation() {
  const response = await apiClient.post("/notifications/evaluate");
  return response.data;
}
