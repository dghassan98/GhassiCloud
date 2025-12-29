import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, Settings, LogOut, 
  Moon, Sun, Menu, X, Bell, CloudSun, BarChart3
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo } from '../context/LogoContext'
import '../styles/layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currentLogo } = useLogo()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  
  const showBrandText = currentLogo.id !== 'cloud-only' && currentLogo.id !== 'full-logo'
  const isWideLogo = currentLogo.id === 'cloud-only'
  const isFullLogo = currentLogo.id === 'full-logo'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
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
            <span>Dashboard</span>
          </NavLink>
          <NavLink 
            to="/reporting" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <BarChart3 size={20} />
            <span>Reporting</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {/* <div className="weather-card">
            <CloudSun size={24} />
            <div className="weather-info">
              <span className="weather-temp">18°C</span>
              <span className="weather-desc">Partly Cloudy</span>
            </div>
          </div> */}

          <div
            className="user-info clickable"
            role="button"
            tabIndex={0}
            onClick={() => { navigate('/settings'); setSidebarOpen(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/settings'); setSidebarOpen(false) } }}
            aria-label="Open profile settings"
          >
            <div className="avatar">
              {user?.avatar ? <img src={user.avatar} alt={user.displayName || user.username || 'Avatar'} /> : (user?.username?.charAt(0).toUpperCase() || 'U')}
            </div>
            <div className="user-details">
              <span className="username">{user?.displayName || 'User'}</span>
              <span className="role">{user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Member'}</span>
            </div>
          </div>
          
          <div className="footer-actions">
            <button 
              className="icon-button" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" title="Notifications">
              <Bell size={18} />
            </button>
            <button 
              className="icon-button" 
              onClick={handleLogout}
              title="Sign out"
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
