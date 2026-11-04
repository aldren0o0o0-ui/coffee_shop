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
    { id: "owner", label: "Owner" },
    { id: "manager", label: "Manager" },
    { id: "cashier", label: "Cashier (POS)" },
    { id: "barista", label: "Barista (KDS)" },
    { id: "inventory", label: "Inventory" },
  ];

  return (
    <div className="space-y-6">
      {/* Role Switcher Toolbar for Owner / Multi-role */}
      {canSwitchRoles && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs">
          <div>
            <p className="text-xs font-bold text-stone-900">Workstation View</p>
            <p className="text-[11px] text-stone-500">Switch operational preview by role</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {roleTabs.map((tab) => {
              const isActive = activeRoleView === tab.id;
              return (
                <button
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-stone-900 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveRoleView(tab.id)}
                  type="button"
                >
                  {tab.label}
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
