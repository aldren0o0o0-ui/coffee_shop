import apiClient from "../../../api/client";

export async function changePasswordApi(data) {
  const response = await apiClient.post("/auth/change-password", data);
  return response.data;
}

export async function getCurrentUserApi() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}
