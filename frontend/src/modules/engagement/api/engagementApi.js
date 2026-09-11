import apiClient from "../../../api/client";
export const previewWinBackAudience = async (inactiveDays) => (await apiClient.post("/engagement/win-back/audience", { inactive_days: inactiveDays })).data;
