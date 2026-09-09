import apiClient from "../../../api/client";

export async function lookupCustomer({ email, phone } = {}) {
  const params = {};
  if (email) params.email = email;
  if (phone) params.phone = phone;
  const response = await apiClient.get("/customers/lookup", { params });
  return response.data;
}

export async function getCustomer(customerId) {
  const response = await apiClient.get(`/customers/${customerId}`);
  return response.data;
}

export async function updateCustomerProfile(customerId, profileData) {
  const response = await apiClient.patch(`/customers/${customerId}`, profileData);
  return response.data;
}

export async function toggleCustomerBlock(customerId, isBlocked, reason = null) {
  const response = await apiClient.patch(`/customers/${customerId}/block`, {
    is_blocked: isBlocked,
    reason,
  });
  return response.data;
}

export async function getCustomerLoyalty(customerId, limit = 20) {
  const response = await apiClient.get(`/customers/${customerId}/loyalty`, {
    params: { limit },
  });
  return response.data;
}

export async function adjustCustomerLoyalty(customerId, { points, description }) {
  const response = await apiClient.post(`/customers/${customerId}/loyalty/adjust`, {
    points,
    description,
  });
  return response.data;
}

export async function redeemCustomerLoyalty(customerId, { points, orderId = null, description = null }) {
  const response = await apiClient.post(`/customers/${customerId}/loyalty/redeem`, {
    points,
    order_id: orderId,
    description,
  });
  return response.data;
}
