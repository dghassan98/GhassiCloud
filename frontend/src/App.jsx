import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLanguage } from './context/LanguageContext'
import Login from './pages/Login'
import SSOCallback from './pages/SSOCallback'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Reporting from './pages/Reporting'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>{t('app.loading')}</p>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="reporting" element={<Reporting />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
