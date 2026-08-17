import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/client";


const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] =
    useState(true);

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
    const response = await apiClient.post(
      "/auth/login",
      credentials,
    );

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

  const hasRole = useCallback(
    (roleName) =>
      user?.roles.some(
        (role) =>
          role.role_name.toLowerCase()
          === roleName.toLowerCase(),
      ) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isCheckingSession,
      login,
      logout,
      hasRole,
      refreshUser: checkSession,
    }),
    [
      user,
      isCheckingSession,
      login,
      logout,
      hasRole,
      checkSession,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}