import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./AuthContext";


export default function RoleRoute({
  allowedRoles,
}) {
  const { user } = useAuth();

  const userRoles = new Set(
    user.roles.map((role) =>
      role.role_name.toLowerCase(),
    ),
  );

  const hasAccess = allowedRoles.some((role) =>
    userRoles.has(role.toLowerCase()),
  );

  if (!hasAccess) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}