import { useState } from 'react'
import './App.css'
import AuthForm from './auth/AuthForm';
import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import Dashboard from './pages/Dashboard';

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

  return <AuthForm />;

}


function App() {
  return (
    <Routes>
      <Route 
        element={<LoginRoute />}
        path='/login' />
      
      <Route element={<ProtectedRoute />} >
        <Route element={<Dashboard />} path='/' />
      </Route>

      <Route element={<Navigate replace to="/" />} path='*' />
    </Routes>
  )
}

export default App
