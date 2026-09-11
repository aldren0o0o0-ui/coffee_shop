import apiClient from "../../../api/client";

export async function fetchMenuCosting() {
  const response = await apiClient.get("/costing/menu");
  return response.data;
}
