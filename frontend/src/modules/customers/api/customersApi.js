import apiClient from "../../../api/client";
export const fetchCustomerMetrics = async (customerId) => (await apiClient.get(`/customers/${customerId}/metrics`)).data;
export const lookupCustomer = async (email) => (await apiClient.get("/customers/lookup", { params: { email } })).data;
export const updateCustomerPreferences = async (customerId, data) => (await apiClient.put(`/customers/${customerId}/preferences`, data)).data;
