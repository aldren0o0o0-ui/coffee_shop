import { useState } from "react";
import { useAuth } from "../../auth/context/useAuth";

import OwnerDashboard from "../components/OwnerDashboard";
import ManagerDashboard from "../components/ManagerDashboard";
import CashierDashboard from "../components/CashierDashboard";
import BaristaDashboard from "../components/BaristaDashboard";
import InventoryStaffDashboard from "../components/InventoryStaffDashboard";

export default function DashboardPage() {
  const { user, hasRole, openPasswordModal } = useAuth();

  // Determine user's default role
  const userRoles = user?.roles?.map((r) => r.role_name.toLowerCase()) || [];
  let defaultRole = "cashier";

  if (userRoles.includes("owner")) {
    defaultRole = "owner";
  } else if (userRoles.includes("manager")) {
    defaultRole = "manager";
  } else if (userRoles.includes("barista")) {
    defaultRole = "barista";
  } else if (userRoles.includes("inventory staff") || userRoles.includes("inventory_staff")) {
    defaultRole = "inventory";
  } else if (userRoles.includes("cashier")) {
    defaultRole = "cashier";
  }

  const [activeRoleView, setActiveRoleView] = useState(defaultRole);

  const canSwitchRoles = hasRole("owner") || hasRole("manager");

  const roleTabs = [
    { id: "owner", label: "Owner", icon: "👑" },
    { id: "manager", label: "Manager", icon: "🏪" },
    { id: "cashier", label: "Cashier (POS)", icon: "💳" },
    { id: "barista", label: "Barista (KDS)", icon: "☕" },
    { id: "inventory", label: "Inventory Staff", icon: "📦" },
  ];

  return (
    <div className="space-y-6">
      {/* Role Switcher Toolbar for Owner / Multi-role */}
      {canSwitchRoles && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm">
              👁️
            </span>
            <div>
              <p className="text-xs font-bold text-stone-900">Role Dashboard Switcher</p>
              <p className="text-[11px] text-stone-500">Preview workstation view by role capability</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {roleTabs.map((tab) => {
              const isActive = activeRoleView === tab.id;
              return (
                <button
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-900 text-white shadow-xs"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveRoleView(tab.id)}
                  type="button"
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Render Active Role Dashboard */}
      {activeRoleView === "owner" && (
        <OwnerDashboard onOpenPasswordModal={openPasswordModal} />
      )}
      {activeRoleView === "manager" && (
        <ManagerDashboard onOpenPasswordModal={openPasswordModal} />
      )}
      {activeRoleView === "cashier" && (
        <CashierDashboard onOpenPasswordModal={openPasswordModal} />
      )}
      {activeRoleView === "barista" && (
        <BaristaDashboard onOpenPasswordModal={openPasswordModal} />
      )}
      {activeRoleView === "inventory" && (
        <InventoryStaffDashboard onOpenPasswordModal={openPasswordModal} />
      )}
    </div>
  );
}
