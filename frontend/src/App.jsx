import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/shared/Layout'
import LoginPage from './pages/LoginPage'
import UserDashboard from './components/user/UserDashboard'
import NewRequestPage from './pages/NewRequestPage'
import ApproverQueue from './components/approver/ApproverQueue'
import AuditLogPage from './pages/AuditLogPage'

function RequireAuth({ children, roles }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          user
            ? <Navigate to={user.role === 'user' ? '/dashboard' : '/approver'} replace />
            : <Navigate to="/login" replace />
        } />

        {/* User routes */}
        <Route path="/dashboard" element={
          <RequireAuth>
            <Layout><UserDashboard /></Layout>
          </RequireAuth>
        } />
        <Route path="/request/new" element={
          <RequireAuth>
            <Layout><NewRequestPage /></Layout>
          </RequireAuth>
        } />

        {/* Approver / Admin routes */}
        <Route path="/approver" element={
          <RequireAuth roles={['approver', 'admin']}>
            <Layout><ApproverQueue /></Layout>
          </RequireAuth>
        } />
        <Route path="/audit" element={
          <RequireAuth roles={['approver', 'admin']}>
            <Layout><AuditLogPage /></Layout>
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
