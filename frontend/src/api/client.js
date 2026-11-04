import axios from "axios";

const rawBase = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const cleanBase = rawBase.trim().replace(/\/+$/, "");
const baseURL = cleanBase.endsWith("/api/v1") ? cleanBase : `${cleanBase}/api/v1`;

const apiClient = axios.create({
    baseURL,
    withCredentials: true,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json"
    }
});

export default apiClient;
