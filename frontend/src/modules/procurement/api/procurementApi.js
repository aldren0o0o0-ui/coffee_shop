import apiClient from "../../../api/client";

export async function fetchPurchaseRequests(statusFilter = null) {
  const params = statusFilter ? { status: statusFilter } : {};
  const response = await apiClient.get("/procurement/requests", { params });
  return response.data;
}

export async function fetchPurchaseRequestById(requestId) {
  const response = await apiClient.get(`/procurement/requests/${requestId}`);
  return response.data;
}

export async function createPurchaseRequest(requestData) {
  const response = await apiClient.post("/procurement/requests", requestData);
  return response.data;
}

export async function updatePurchaseRequest(requestId, requestData) {
  const response = await apiClient.put(`/procurement/requests/${requestId}`, requestData);
  return response.data;
}

export async function submitPurchaseRequest(requestId) {
  const response = await apiClient.post(`/procurement/requests/${requestId}/submit`);
  return response.data;
}

export async function approvePurchaseRequest(requestId) {
  const response = await apiClient.post(`/procurement/requests/${requestId}/approve`);
  return response.data;
}

export async function rejectPurchaseRequest(requestId, rejectionReason) {
  const response = await apiClient.post(`/procurement/requests/${requestId}/reject`, {
    rejection_reason: rejectionReason,
  });
  return response.data;
}

export async function receivePurchaseRequest(requestId) {
  const response = await apiClient.post(`/procurement/requests/${requestId}/receive`);
  return response.data;
}
