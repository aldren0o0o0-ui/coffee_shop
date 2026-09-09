import apiClient from "../../../api/client";

function generateClientUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrderPayments(orderId) {
  const response = await apiClient.get(`/payments/order/${orderId}`);
  return response.data;
}

export async function getPayment(paymentId) {
  const response = await apiClient.get(`/payments/${paymentId}`);
  return response.data;
}

export async function getOrderReceipt(orderId) {
  const response = await apiClient.get(`/payments/receipt/${orderId}`);
  return response.data;
}

export async function payCustomerOrder(orderId, email, paymentMethod = "card", customIdempotencyKey = null) {
  const idempotencyKey = customIdempotencyKey || generateClientUuid();
  const response = await apiClient.post(`/customer/orders/${orderId}/pay`, {
    email: email.trim().toLowerCase(),
    payment_method: paymentMethod,
    idempotency_key: idempotencyKey,
  });
  return response.data;
}

export async function payAtCounter(orderId, { paymentMethod = "cash", amountTendered = null } = {}) {
  const response = await apiClient.post(`/orders/${orderId}/pay-at-counter`, {
    payment_method: paymentMethod,
    amount_tendered: amountTendered ? Number(amountTendered) : null,
  });
  return response.data;
}
