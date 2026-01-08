import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, User, Eye, EyeOff, ArrowRight, AlertTriangle, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo } from '../context/LogoContext'
import { useLanguage } from '../context/LanguageContext'
import { useNetwork } from '../hooks/useCapacitor'
import '../styles/login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [showSessionExpired, setShowSessionExpired] = useState(false)
  const { login, loginWithSSO, checkAuth, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currentLogo } = useLogo()
  const { t } = useLanguage()
  const { isConnected } = useNetwork()
  const navigate = useNavigate()
  
  const showBrandText = currentLogo.id !== 'cloud-only'
  const isWideLogo = currentLogo.id === 'cloud-only'

  // Check for SSO errors from callback page
  useEffect(() => {
    try {
      const ssoError = localStorage.getItem('sso_error')
      if (ssoError) {
        setError(ssoError)
        localStorage.removeItem('sso_error')
      }
    } catch (e) {}
  }, [])

  // Check for session expired flag
  useEffect(() => {
    try {
      const sessionExpired = localStorage.getItem('session_expired')
      if (sessionExpired) {
        setShowSessionExpired(true)
        localStorage.removeItem('session_expired')
      }
    } catch (e) {}
  }, [])

  // If user is already authenticated (e.g., after SSO callback), redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('ghassicloud-token')
    if (token && !user) {
      // Check if authentication is valid
      checkAuth()
    }
  }, [checkAuth, user])

  // Redirect when user becomes authenticated
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSSOLogin = async () => {
    setError('')
    setSsoLoading(true)
    
    try {
      // loginWithSSO may navigate away for redirect flow (mobile/PWA)
      // In that case, this promise never resolves
      await loginWithSSO()
      // Only reached for popup flow that succeeds
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSsoLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Offline Banner */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <WifiOff size={20} />
            <div style={{ textAlign: 'center' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                {t('offline.title')}
              </strong>
              <span style={{ fontSize: '14px' }}>
                {t('offline.message')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated background */}
      <div className="login-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-overlay" />
      </div>

      <motion.div 
        className="login-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo & Branding */}
        <motion.div 
          className="login-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={`logo ${isWideLogo ? 'wide' : ''}`}>
            <img src={currentLogo.path} alt="GhassiCloud" />
          </div>
          <AnimatePresence>
            {showBrandText && (
              <motion.h1
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                GhassiCloud
              </motion.h1>
            )}
          </AnimatePresence>
          <p>Embrace Digital Sovereignty.</p>
        </motion.div>

        {/* Login Form */}
        <motion.form 
          className="login-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className="input-group">
            <User size={20} className="input-icon" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <motion.button
            type="submit"
            className="login-button"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <div className="button-spinner" />
            ) : (
              <>
                Sign In
                <ArrowRight size={20} />
              </>
            )}
          </motion.button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <motion.button
            type="button"
            className="sso-button"
            disabled={ssoLoading}
            onClick={handleSSOLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {ssoLoading ? (
              <div className="button-spinner" />
            ) : (
              <>
                <img
                  src="https://icons.duckduckgo.com/ip3/ghassandarwish.com.ico"
                  alt="GhassiCloud"
                  className="sso-icon"
                />
                Sign in with GhassiCloud
              </>
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <motion.div 
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
        </motion.div>
      </motion.div>

      {/* Session Expired Modal */}
      <AnimatePresence>
        {showSessionExpired && (
          <motion.div
            className="session-expired-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSessionExpired(false)}
          >
            <motion.div
              className="session-expired-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="session-expired-icon">
                <AlertTriangle size={48} />
              </div>
              <h2>{t('sessionExpired.title') || 'Session Expired'}</h2>
              <p>{t('sessionExpired.message') || 'Your session has expired. Please sign in again to continue.'}</p>
              <button 
                className="session-expired-button"
                onClick={() => setShowSessionExpired(false)}
              >
                {t('sessionExpired.ok') || 'OK'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
