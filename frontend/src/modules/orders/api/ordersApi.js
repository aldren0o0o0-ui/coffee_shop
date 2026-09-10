import apiClient from "../../../api/client";

export async function fetchAllOrders() {
  const response = await apiClient.get("/orders");
  return response.data;
}

export async function updateOrderStatus(orderId, newStatus) {
  const response = await apiClient.patch(`/orders/${orderId}/status`, {
    status: (newStatus || "").toLowerCase(),
  });
  return response.data;
}

export async function createPosOrder(payload) {
  const response = await apiClient.post("/orders/pos", payload);
  return response.data;
}

export async function lookupPendingCounterOrders(query = "") {
  const qStr = query ? `?q=${encodeURIComponent(query)}` : "";
  const response = await apiClient.get(`/orders/counter-lookup${qStr}`);
  return response.data;
}

export async function payPendingCounterOrder(orderId, payload) {
  const response = await apiClient.post(`/orders/${orderId}/pay-at-counter`, payload);
  return response.data;
}

export async function submitCustomerOrder(orderPayload) {
  const response = await apiClient.post("/customer/orders", orderPayload);
  return response.data;
}

export async function trackCustomerOrder(orderId, email) {
  const response = await apiClient.post("/customer/orders/track", {
    order_id: Number(orderId),
    email: email.trim().toLowerCase(),
  });
  return response.data;
}

export async function updatePendingOrder(orderId, payload) {
  const response = await apiClient.put(`/orders/${orderId}`, payload);
  return response.data;
}
