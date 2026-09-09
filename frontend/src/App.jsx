import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './modules/auth/context/useAuth';
import AuthForm from './modules/auth/components/AuthForm';
import ProtectedRoute from './modules/auth/components/ProtectedRoute';
import RoleRoute from './modules/auth/components/RoleRoute';
import AppLayout from './layouts/AppLayout';
import Dashboard from './modules/analytics/pages/DashboardPage';
import Team from './modules/users/pages/TeamPage';
import Menu from './modules/menu/pages/MenuManagementPage';
import CustomerOrderPage from './modules/orders/pages/CustomerOrderPage';
import CustomerTrackingPage from './modules/orders/pages/CustomerTrackingPage';
import CustomerBrowsePage from './modules/menu/pages/CustomerBrowsePage';
import LandingPage from './pages/LandingPage';

import PosPage from './modules/orders/pages/PosPage';
import OrdersPage from './modules/orders/pages/OrdersPage';
import DrinkPreparationPage from './modules/orders/pages/DrinkPreparationPage';
import InventoryPage from './modules/inventory/pages/InventoryPage';
import PurchasingPage from './modules/procurement/pages/PurchasingPage';
import ReportsPage from './modules/analytics/pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

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
    <Routes>
      {/* Public Landing Page for Viewers */}
      <Route element={<LandingPage />} path="/" />

      {/* Public Customer Browsing, Ordering & Tracking */}
      <Route element={<CustomerBrowsePage />} path="/browse" />
      <Route element={<CustomerOrderPage />} path="/order" />
      <Route element={<CustomerTrackingPage />} path="/track" />

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
  );
}

export default App;
