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
import logger from './logger'
import { 
  initializeNativeFeatures, 
  useAppLifecycle, 
  useNetwork,
  isNative 
} from './hooks/useCapacitor'
import { WebviewProvider } from './context/WebviewContext'
import WebViewModal from './components/WebViewModal'

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
  const { user } = useAuth()
  const { isConnected } = useNetwork()
  const { showUpdateModal, showChangelog, updateNow, dismissUpdate, dismissChangelog } = usePWAUpdate()

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
          logger.info('Orientation locked to portrait')
        } catch (err) {
          logger.info('Orientation lock not supported:', err)
        }
      }
    }

    lockOrientation()
  }, [])

  // Handle app lifecycle events
  useAppLifecycle({
    onResume: () => {
      logger.info('App resumed')
      // You can refresh data here when app comes back to foreground
    },
    onPause: () => {
      logger.info('App paused')
      // Save any pending state here
    },
    onBackButton: ({ canGoBack }) => {
      if (!canGoBack) {
        // At root of app - could show exit confirmation
        logger.info('At root, cannot go back')
      }
    }
  })

  return (
    <BrowserRouter>
      <WebviewProvider>
        {!isConnected && <OfflineBanner />}
        
        {/* PWA Update Notifications */}
        {showUpdateModal && (
          <UpdateNotification onUpdate={updateNow} onDismiss={dismissUpdate} />
        )}
        {/* Only show changelog when user is logged in */}
        {user && showChangelog && <ChangelogModal onClose={dismissChangelog} />}
        
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
        <WebViewModal />
      </WebviewProvider>
    </BrowserRouter>
  )
}

export default App
