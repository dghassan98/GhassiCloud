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
  useNetwork 
} from './hooks/useCapacitor'
import { WebviewProvider } from './context/WebviewContext'
import { useRamadan } from './context/RamadanContext'
import WebViewModal from './components/WebViewModal'
import RamadanOverlay from './components/RamadanOverlay'

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
  const { isRamadanActive } = useRamadan()

  // Toggle body class for the Ramadan ambient effect
  useEffect(() => {
    if (isRamadanActive) {
      document.body.classList.add('ramadan-active')
    } else {
      document.body.classList.remove('ramadan-active')
    }
    return () => document.body.classList.remove('ramadan-active')
  }, [isRamadanActive])

  useEffect(() => {
    const statusBarColor = theme === 'dark' ? '#0f172a' : '#ffffff'
    initializeNativeFeatures({
      statusBarColor,
      statusBarStyle: theme === 'dark' ? 'dark' : 'light',
      hideSplashDelay: 500
    })
  }, [theme])

  // PWA mobile
  useEffect(() => {
    const lockOrientation = async () => {
      // Only attempt orientation lock on mobile devices and in native apps
      const isTablet = window.innerWidth >= 768
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (!isTablet && isMobileDevice && screen.orientation && screen.orientation.lock) {
        try {
          // Check if document is in fullscreen (required for web browsers)
          const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement
          
          // Only lock if in fullscreen or likely a PWA/native app
          if (isFullscreen || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
            await screen.orientation.lock('portrait')
            logger.info('Orientation locked to portrait')
          }
        } catch (err) {
          // Silently fail - orientation lock isn't critical functionality
          logger.debug('Orientation lock not available:', err.message)
        }
      }
    }

    lockOrientation()
  }, [])

  useAppLifecycle({
    onResume: () => {
      logger.info('App resumed')
    },
    onPause: () => {
      logger.info('App paused')
    },
    onBackButton: ({ canGoBack }) => {
      if (!canGoBack) {
        logger.info('At root, cannot go back')
      }
    }
  })

  return (
    <BrowserRouter>
      <WebviewProvider>
        {!isConnected && <OfflineBanner />}
        <RamadanOverlay />
        
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