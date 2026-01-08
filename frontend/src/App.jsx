import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLanguage } from './context/LanguageContext'
import { useTheme } from './context/ThemeContext'
import Login from './pages/Login'
import SSOCallback from './pages/SSOCallback'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Reporting from './pages/Reporting'
import Layout from './components/Layout'
import SSOSessionManager from './components/SSOSessionManager'
import UpdateNotification from './components/UpdateNotification'
import ChangelogModal from './components/ChangelogModal'
import { usePWAUpdate } from './hooks/usePWAUpdate'
import { 
  initializeNativeFeatures, 
  useAppLifecycle, 
  useNetwork,
  isNative 
} from './hooks/useCapacitor'

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

// Offline banner component
function OfflineBanner() {
  const { t } = useLanguage()
  return (
    <div className="offline-banner">
      <span>📡 {t('app.offline') || 'You are offline'}</span>
    </div>
  )
}

function App() {
  const { theme } = useTheme()
  const { isConnected } = useNetwork()
  const { showUpdateModal, showChangelog, updateNow, dismissUpdate, dismissChangelog } = usePWAUpdate()
  
  // Debug: show current version (remove this later)
  const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'

  // Initialize native features on mount
  useEffect(() => {
    const statusBarColor = theme === 'dark' ? '#0f172a' : '#ffffff'
    initializeNativeFeatures({
      statusBarColor,
      statusBarStyle: theme === 'dark' ? 'dark' : 'light',
      hideSplashDelay: 500
    })
  }, [theme])

  // Lock orientation to portrait on phones (not tablets)
  useEffect(() => {
    const lockOrientation = async () => {
      // Check if device is a tablet (width >= 768px typically indicates tablet)
      const isTablet = window.innerWidth >= 768
      
      if (!isTablet && screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock('portrait')
          console.log('Orientation locked to portrait')
        } catch (err) {
          console.log('Orientation lock not supported:', err)
        }
      }
    }

    lockOrientation()
  }, [])

  // Handle app lifecycle events
  useAppLifecycle({
    onResume: () => {
      console.log('App resumed')
      // You can refresh data here when app comes back to foreground
    },
    onPause: () => {
      console.log('App paused')
      // Save any pending state here
    },
    onBackButton: ({ canGoBack }) => {
      if (!canGoBack) {
        // At root of app - could show exit confirmation
        console.log('At root, cannot go back')
      }
    }
  })

  return (
    <BrowserRouter>
      {/* Debug version banner - remove after testing */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        background: '#0891b2', 
        color: 'white', 
        padding: '4px 8px', 
        fontSize: '12px', 
        textAlign: 'center',
        zIndex: 99999 
      }}>
        v{currentVersion} | Update: {showUpdateModal ? '✅' : '❌'} | Changelog: {showChangelog ? '✅' : '❌'}
      </div>
      
      {!isConnected && <OfflineBanner />}
      
      {/* PWA Update Notifications */}
      {showUpdateModal && (
        <UpdateNotification onUpdate={updateNow} onDismiss={dismissUpdate} />
      )}
      {showChangelog && <ChangelogModal onClose={dismissChangelog} />}
      
      <SSOSessionManager />
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
