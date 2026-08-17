import { useState } from 'react'
import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import AuthForm from './auth/AuthForm';
import ProtectedRoute from './auth/ProtectedRoute';
import RoleRoute from './auth/RoleRoute';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
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
      <Route 
        element={<LoginRoute />}
        path='/login' />
      
      <Route element={<ProtectedRoute />} >
        <Route element={<AppLayout />}>
          <Route element={<Dashboard />} index />

          <Route element={<PlaceholderPage description="Take customer orders and prepare checkout" title="Point of Sale" />} path='pos' />
          <Route element={<PlaceholderPage description="Review and manage customer orders" title="Orders" />} path='orders' />
          <Route element={<PlaceholderPage description="View Drinks waiting to be prepared." title="Drink preparations" />} path='preparation' />
          <Route element={<PlaceholderPage description="Manage Products, sizes, and add-ons." title="Menu" />} path='menu' />
          <Route element={<PlaceholderPage description="Review ingredients and stock level" title="Stock" />} path='inventory' />
          <Route element={<PlaceholderPage description="Request and receive shop supplies." title="Purchasing" />} path='purchasing' />
          <Route element={<PlaceholderPage description="review shop performance and activity" title="Reports" />} path='reports' />
          <Route element={<PlaceholderPage description="Manage shop and preferences" title="Settings" />} path='settings' />

          <Route element={<RoleRoute allowedRoles={["owner"]} />} >
            <Route element={<PlaceholderPage description="Add team members and manage their access." title="Team" />} path='team' />
          </Route>

        </Route>
      </Route>

      <Route element={<Navigate replace to="/" />} path='*' />
    </Routes>
  )
}

export default App
