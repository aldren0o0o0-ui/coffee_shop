import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../../../api/client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await apiClient.get("/auth/me");
      setUser(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
      } else {
        console.error("Unable to check the current session.");
        setUser(null);
      }
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (credentials) => {
    const response = await apiClient.post("/auth/login", credentials);
    setUser(response.data);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (passwordData) => {
    const response = await apiClient.post("/auth/change-password", passwordData);
    setUser(response.data);
    return response.data;
  }, []);

  const hasRole = useCallback(
    (roleName) =>
      user?.roles.some(
        (role) =>
          role.role_name.toLowerCase() === roleName.toLowerCase(),
      ) ?? false,
    [user],
  );

  const openPasswordModal = useCallback(() => {
    setIsPasswordModalOpen(true);
  }, []);

  const closePasswordModal = useCallback(() => {
    setIsPasswordModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isCheckingSession,
      login,
      logout,
      changePassword,
      hasRole,
      refreshUser: checkSession,
      isPasswordModalOpen,
      openPasswordModal,
      closePasswordModal,
    }),
    [
      user,
      isCheckingSession,
      login,
      logout,
      changePassword,
      hasRole,
      checkSession,
      isPasswordModalOpen,
      openPasswordModal,
      closePasswordModal,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

