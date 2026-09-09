import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";


export default function RoleRoute({
  allowedRoles,
}) {
  const { user } = useAuth();

  const userRoles = new Set(
    (user?.roles || []).map((role) =>
      role.role_name.toLowerCase().replace(/_/g, " ").trim()
    )
  );

  const hasAccess = allowedRoles.some((role) =>
    userRoles.has(role.toLowerCase().replace(/_/g, " ").trim())
  );

  if (!hasAccess) {
    return <Navigate replace to="/overview" />;
  }

  return <Outlet />;
}
