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

import PosPage from './modules/orders/pages/PosPage';
import OrdersPage from './modules/orders/pages/OrdersPage';
import DrinkPreparationPage from './modules/orders/pages/DrinkPreparationPage';

import PlaceholderPage from './pages/PlaceholderPage';

function LoginRoute() {
  const { 
    isAuthenticated, isCheckingSession
  } = useAuth();

  if(isCheckingSession) {
    return(
      <main className='flex min-h-screen items-center justify-center bg-stone-100'>
        <p className='text-stone-600'>
          Checking your session...
        </p>
      </main>
    );
  }

  if(isAuthenticated) {
    return <Navigate replace to="/" />
  }

  return <AuthForm />;

}


function App() {
  return (
    <Routes>
      {/* Public Customer Browsing, Ordering & Tracking */}
      <Route element={<CustomerBrowsePage />} path='/browse' />
      <Route element={<CustomerOrderPage />} path='/order' />
      <Route element={<CustomerTrackingPage />} path='/track' />

      <Route 
        element={<LoginRoute />}
        path='/login' />
      
      <Route element={<ProtectedRoute />} >
        <Route element={<AppLayout />}>
          <Route element={<Dashboard />} index />

          <Route element={<PosPage />} path='pos' />
          <Route element={<OrdersPage />} path='orders' />
          <Route element={<DrinkPreparationPage />} path='preparation' />
          <Route element={<Menu />} path='menu' />
          <Route element={<PlaceholderPage description="Review ingredients and stock level" title="Stock" />} path='inventory' />
          <Route element={<PlaceholderPage description="Request and receive shop supplies." title="Purchasing" />} path='purchasing' />
          <Route element={<PlaceholderPage description="review shop performance and activity" title="Reports" />} path='reports' />

          <Route element={<PlaceholderPage description="Manage shop and preferences" title="Settings" />} path='settings' />

          <Route element={<RoleRoute allowedRoles={["owner"]} />} >
            <Route element={<Team />} path='team' />
          </Route>

        </Route>
      </Route>

      <Route element={<Navigate replace to="/" />} path='*' />
    </Routes>
  )
}

export default App
