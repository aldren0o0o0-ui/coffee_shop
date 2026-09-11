import apiClient from "../../../api/client";
export const fetchCurrentShift = async () => (await apiClient.get("/shifts/current")).data;
export const openShift = async (data) => (await apiClient.post("/shifts/open", data)).data;
export const closeShift = async (id, data) => (await apiClient.post(`/shifts/${id}/close`, data)).data;
export const addCashMovement = async (id, data) => (await apiClient.post(`/shifts/${id}/movements`, data)).data;
export const fetchVarianceReviews = async () => (await apiClient.get("/shifts/variance-reviews")).data;
export const approveVariance = async (id) => (await apiClient.post(`/shifts/${id}/approve-variance`)).data;
