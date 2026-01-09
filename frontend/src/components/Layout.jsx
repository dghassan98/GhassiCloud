import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, Settings, LogOut, 
  Moon, Sun, Menu, X, Bell, CloudSun, BarChart3
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo } from '../context/LogoContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useGestures, useSwipe } from '../hooks/useGestures'
import { isPWA } from '../hooks/useCapacitor'
import { useWebview } from '../context/WebviewContext'
import '../styles/layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currentLogo } = useLogo()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { openWebview } = useWebview()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const exitTimerRef = useRef(null)
  const [canExit, setCanExit] = useState(false)

  // Intercept external links (target="_blank") when running as an installed PWA
  useEffect(() => {
    if (!isPWA()) return

    const onDocClick = (e) => {
      try {
        const anchor = e.target.closest && e.target.closest('a[target="_blank"], a[target="_new"]')
        if (!anchor) return
        const href = anchor.getAttribute('href')
        if (!href) return
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
        e.preventDefault()
        openWebview(href, anchor.getAttribute('title') || anchor.textContent?.trim() || undefined)
      } catch (err) {
        // ignore
      }
    }

    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [openWebview])
  
  const showBrandText = currentLogo.id !== 'cloud-only' && currentLogo.id !== 'full-logo'
  const isWideLogo = currentLogo.id === 'cloud-only'
  const isFullLogo = currentLogo.id === 'full-logo'

  // Navigation history for back gesture
  const canGoBack = location.key !== 'default'
  const isDashboard = location.pathname === '/'

  // Reset exit confirmation when navigating away from dashboard
  useEffect(() => {
    if (!isDashboard) {
      setCanExit(false)
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [isDashboard])

  // Handle back gesture with exit confirmation on dashboard
  const handleBackGesture = () => {
    // If sidebar is open, close it
    if (sidebarOpen) {
      return
    }

    // If on dashboard, handle exit confirmation
    if (isDashboard) {
      if (canExit) {
        // Second back press - exit app or go to login
        window.history.back()
      } else {
        // First back press - show warning
        setCanExit(true)
        showToast({
          message: t('nav.pressBackAgain') || 'Press back again to exit',
          type: 'info',
          duration: 2000
        })
        
        // Reset after 2 seconds
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current)
        }
        exitTimerRef.current = setTimeout(() => {
          setCanExit(false)
        }, 2000)
      }
    } else if (canGoBack) {
      // On other pages, navigate back normally
      navigate(-1)
    } else if (!sidebarOpen) {
      // No history, open sidebar
      setSidebarOpen(true)
    }
  }

  // Long press on hamburger menu
  const hamburgerGestures = useGestures({
    onLongPress: () => setSidebarOpen(true),
    longPressDuration: 400
  })

  // Swipe gestures for navigation
  const swipeGestures = useSwipe({
    onRight: handleBackGesture,
    onLeft: () => {
      // Swipe left to close sidebar
      if (sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    threshold: 100
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout" {...swipeGestures}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="menu-toggle long-press-target"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          {...hamburgerGestures.touchHandlers}
          aria-label={sidebarOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className={`logo ${isFullLogo ? 'centered' : ''}`} onClick={() => navigate('/')}>
          <div className="logo-flip">
            <img 
              src={currentLogo.path} 
              alt="GhassiCloud" 
              className={`logo-img ${isWideLogo ? 'wide' : ''} ${isFullLogo ? 'full' : ''}`} 
            />
          </div>
          <AnimatePresence>
            {showBrandText && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3 }}
              >
                GhassiCloud
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Sidebar */}
      <motion.aside 
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
        initial={false}
      >
        <div className="sidebar-header">
          <div className={`logo ${isFullLogo ? 'centered' : ''}`} onClick={() => navigate('/')}>
            <div className="logo-flip">
              <img 
                src={currentLogo.path} 
                alt="GhassiCloud" 
                className={`logo-img ${isWideLogo ? 'wide' : ''} ${isFullLogo ? 'full' : ''}`} 
              />
            </div>
            <AnimatePresence>
              {showBrandText && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  GhassiCloud
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <LayoutDashboard size={20} />
            <span>{t('nav.dashboard')}</span>
          </NavLink>
          <NavLink 
            to="/reporting" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <BarChart3 size={20} />
            <span>{t('nav.reporting')}</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Settings size={20} />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {/* <div className="weather-card">
            <CloudSun size={24} />
            <div className="weather-info">
              <span className="weather-temp">{t('layout.weatherTemp')}</span>
              <span className="weather-desc">{t('layout.weatherDesc')}</span>
            </div>
          </div> */}

          <div
            className="user-info clickable"
            role="button"
            tabIndex={0}
            onClick={() => { navigate('/settings'); setSidebarOpen(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/settings'); setSidebarOpen(false) } }}
            aria-label={t('layout.openProfile') || 'Open profile settings'}
          >
            <div className="avatar">
              {user?.avatar ? <img src={user.avatar} alt={user.displayName || user.username || 'Avatar'} /> : (user?.username?.charAt(0).toUpperCase() || 'U')}
            </div>
            <div className="user-details">
              <span className="username">{user?.displayName || t('general.userFallback')}</span>
              <span className="role">{user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : t('general.memberFallback')}</span>
            </div>
          </div>
          
          <div className="footer-actions">
            <button 
              className="icon-button" 
              onClick={toggleTheme}
              title={theme === 'dark' ? t('settings.themeOptions.light') : t('settings.themeOptions.dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" title={t('layout.notifications') || 'Notifications'}>
              <Bell size={18} />
            </button>
            <button 
              className="icon-button" 
              onClick={handleLogout}
              title={t('settings.signOut')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
