import './App.css'
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './modules/auth/context/useAuth';
import { BranchProvider } from './modules/branches/context/BranchProvider';
import AuthForm from './modules/auth/components/AuthForm';
import ProtectedRoute from './modules/auth/components/ProtectedRoute';
import RoleRoute from './modules/auth/components/RoleRoute';
import AppLayout from './layouts/AppLayout';

// Public customer pages (lazy loaded)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CustomerBrowsePage = lazy(() => import('./modules/menu/pages/CustomerBrowsePage'));
const CustomerOrderPage = lazy(() => import('./modules/orders/pages/CustomerOrderPage'));
const CustomerTrackingPage = lazy(() => import('./modules/orders/pages/CustomerTrackingPage'));
const PickupBoardPage = lazy(() => import('./modules/orders/pages/PickupBoardPage'));

// Staff workstation pages (lazy loaded)
const Dashboard = lazy(() => import('./modules/analytics/pages/DashboardPage'));
const PosPage = lazy(() => import('./modules/orders/pages/PosPage'));
const ShiftPage = lazy(() => import('./modules/shifts/pages/ShiftPage'));
const OrdersPage = lazy(() => import('./modules/orders/pages/OrdersPage'));
const DrinkPreparationPage = lazy(() => import('./modules/orders/pages/DrinkPreparationPage'));
const Menu = lazy(() => import('./modules/menu/pages/MenuManagementPage'));
const InventoryPage = lazy(() => import('./modules/inventory/pages/InventoryPage'));
const PurchasingPage = lazy(() => import('./modules/procurement/pages/PurchasingPage'));
const ReportsPage = lazy(() => import('./modules/analytics/pages/ReportsPage'));
const CostingPage = lazy(() => import('./modules/costing/pages/CostingPage'));
const CustomerProfilePage = lazy(() => import('./modules/customers/pages/CustomerProfilePage'));
const Team = lazy(() => import('./modules/users/pages/TeamPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function LoginRoute() {
  const { 
    isAuthenticated, isCheckingSession
  } = useAuth();

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100">
        <p className="text-sm text-stone-600">
          Checking your session…
        </p>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate replace to="/overview" />
  }

  return <AuthForm />;
}

function App() {
  return (
    <BranchProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-stone-100">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl animate-spin">☕</span>
              <p className="text-xs font-semibold text-stone-500">Loading workstation...</p>
            </div>
          </div>
        }
      >
        <Routes>
          {/* Public Landing Page for Viewers */}
          <Route element={<LandingPage />} path="/" />

        {/* Public Customer Browsing, Ordering & Tracking */}
        <Route element={<CustomerBrowsePage />} path="/browse" />
        <Route element={<CustomerOrderPage />} path="/order" />
        <Route element={<CustomerTrackingPage />} path="/track" />
        <Route element={<PickupBoardPage />} path="/pickup" />

        {/* Staff Authentication */}
        <Route element={<LoginRoute />} path="/login" />
        
        {/* Staff Workspace Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<Dashboard />} path="overview" />
            <Route element={<Dashboard />} path="dashboard" />

            {/* POS: Owner, Manager, Cashier */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager", "cashier"]} />}>
              <Route element={<PosPage />} path="pos" />
              <Route element={<ShiftPage />} path="shift" />
              <Route element={<CustomerProfilePage />} path="customers" />
              <Route element={<Navigate to="/pos?mode=lookup" replace />} path="staff/pos" />
            </Route>

            {/* Orders: Owner, Manager, Cashier, Barista */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager", "cashier", "barista"]} />}>
              <Route element={<OrdersPage />} path="orders" />
            </Route>

            {/* Drink Preparation: Owner, Manager, Barista */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager", "barista"]} />}>
              <Route element={<DrinkPreparationPage />} path="preparation" />
            </Route>

            {/* Menu Catalog: Owner, Manager */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager"]} />}>
              <Route element={<Menu />} path="menu" />
            </Route>

            {/* Stock / Inventory: Owner, Manager, Inventory Staff */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager", "inventory staff", "inventory_staff"]} />}>
              <Route element={<InventoryPage />} path="inventory" />
            </Route>

            {/* Purchasing & Procurement: Owner, Manager, Inventory Staff */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager", "inventory staff", "inventory_staff"]} />}>
              <Route element={<PurchasingPage />} path="purchasing" />
            </Route>

            {/* Reports & Analytics: Owner, Manager */}
            <Route element={<RoleRoute allowedRoles={["owner", "manager"]} />}>
              <Route element={<ReportsPage />} path="reports" />
              <Route element={<CostingPage />} path="costing" />
            </Route>

            {/* Team Accounts: Owner only */}
            <Route element={<RoleRoute allowedRoles={["owner"]} />}>
              <Route element={<Team />} path="team" />
            </Route>

            {/* Store Settings: Owner only */}
            <Route element={<RoleRoute allowedRoles={["owner"]} />}>
              <Route element={<SettingsPage />} path="settings" />
            </Route>
          </Route>
        </Route>

          {/* Catch-all fallback */}
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </BranchProvider>
  );
}

export default App;
