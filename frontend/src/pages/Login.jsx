import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo } from '../context/LogoContext'
import { useLanguage } from '../context/LanguageContext'
import { useNetwork } from '../hooks/useCapacitor'
import logger from '../logger'
import '../styles/login.css'

export default function Login() {
  const [error, setError] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
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
    } catch (e) { }
  }, [])

  // Check for session expired flag
  useEffect(() => {
    try {
      const sessionExpired = localStorage.getItem('session_expired')
      if (sessionExpired) {
        setShowSessionExpired(true)
        localStorage.removeItem('session_expired')
      }
    } catch (e) { }
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

  // Generate PKCE code verifier and challenge (same algorithm as AuthContext.generatePKCE)
  const generatePKCE = async () => {
    const array = new Uint8Array(64)
    crypto.getRandomValues(array)
    const codeVerifier = Array.from(array, byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]).join('')

    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    return { codeVerifier, codeChallenge }
  }

  // Registration flow: build Keycloak registrations URL and redirect
  const handleRegister = async () => {
    setError('')
    setRegistering(true)

    try {
      const configRes = await fetch('/api/auth/sso/config')
      if (!configRes.ok) throw new Error('Failed to get SSO configuration')
      const config = await configRes.json()

      // Create CSRF state
      const state = crypto.randomUUID()
      sessionStorage.setItem('sso_state', state)
      localStorage.setItem('sso_state', state)

      // Generate PKCE values and persist verifier for token exchange
      const { codeVerifier, codeChallenge } = await generatePKCE()
      sessionStorage.setItem('sso_code_verifier', codeVerifier)
      localStorage.setItem('sso_code_verifier', codeVerifier)

      // Build redirect URI for the callback (same as SSO login)
      const redirectUri = `${window.location.origin}/sso-callback`
      sessionStorage.setItem('sso_redirect_uri', redirectUri)
      localStorage.setItem('sso_redirect_uri', redirectUri)

      // Ensure redirect flow marker is set (we'll navigate away)
      localStorage.setItem('sso_redirect_flow', 'true')

      // Build registrations endpoint from authUrl
      const authUrl = new URL(config.authUrl)
      // Prefer robust replacement to swap /auth -> /registrations
      let registrationsPath = authUrl.pathname.replace('/protocol/openid-connect/auth', '/protocol/openid-connect/registrations')
      if (registrationsPath === authUrl.pathname) registrationsPath = authUrl.pathname.replace('/auth', '/registrations')
      authUrl.pathname = registrationsPath

      authUrl.searchParams.set('client_id', config.clientId)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'openid')
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('kc_action', 'register')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')

      // Redirect user to registration on the identity provider
      window.location.href = authUrl.toString()

    } catch (err) {
      logger.error('Registration flow failed:', err)
      setError(err.message || 'Registration failed')
      setRegistering(false)
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
        <motion.div
          className="login-form"
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


          <motion.button
            type="button"
            className={`sso-button ${ssoLoading ? 'loading' : ''}`}
            aria-label={t('auth.ssoSignIn') || 'Sign in with GhassiCloud'}
            aria-busy={ssoLoading}
            disabled={ssoLoading}
            onClick={handleSSOLogin}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {ssoLoading ? (
              <div className="sso-loading">
                <div className="button-spinner" aria-hidden="true" />
                <span className="sso-loading-text">{t('auth.redirecting') || 'Redirecting…'}</span>
                <span className="sr-only">{t('auth.redirectingA11y') || 'Redirecting to GhassiCloud single sign-on'}</span>
              </div>
            ) : (
              <>
                <span className="sso-icon-wrapper" aria-hidden="true">
                  <img
                    src="https://icons.duckduckgo.com/ip3/ghassandarwish.com.ico"
                    alt=""
                    className="sso-icon"
                  />
                </span>
                <span className="sso-button-label">{t('auth.ssoSignIn') || 'Sign in with GhassiCloud'}</span>
              </>
            )}
          </motion.button>
          <p className="login-note">{t('auth.socialsNotePrefix') || 'Note:'} {t('auth.socialsNote') ? <><span dangerouslySetInnerHTML={{__html: t('auth.socialsNote')}} /></> : <>Sign in with Socials is available under <strong>{t('auth.signInWithGhassiAuth') || 'Sign in with GhassiAuth'}</strong>.</>} </p>

        </motion.div>

        {/* Footer */}
        <motion.div
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            type="button"
            className="register-button small"
            onClick={handleRegister}
            disabled={registering}
            aria-label={t('auth.registerAria') || t('auth.registerPrompt') || 'Register a new account'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {registering ? (
              <>
                <div className="button-spinner" aria-hidden="true" style={{ width: 12, height: 12 }} />
                {t('auth.registering') || 'Registering…'}
              </>
            ) : (
              t('auth.registerPrompt') || 'New here? Register'
            )}
          </motion.button>
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
